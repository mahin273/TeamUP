import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthTokens, AuthResponse } from './interfaces/tokens.interface';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async loginWithGithub(
    code: string,
    redirectUri?: string,
  ): Promise<AuthResponse> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    // 1. Exchange code for access token
    let tokenRes: Response;
    try {
      const payload: Record<string, string> = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      };
      if (redirectUri) {
        payload.redirect_uri = redirectUri;
      }

      tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'TeamUp-Backend/1.0',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      throw new BadRequestException(
        'Unable to communicate with GitHub OAuth service',
      );
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      throw new BadRequestException(
        tokenData.error_description ||
          'Invalid or expired GitHub authorization code',
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch authenticated GitHub user details
    let userRes: Response;
    try {
      userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'TeamUp-Backend/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });
    } catch (err: unknown) {
      throw new BadRequestException('Unable to fetch GitHub user details');
    }

    if (!userRes.ok) {
      throw new BadRequestException('Failed to retrieve GitHub profile');
    }

    const ghUser = await userRes.json();
    const githubUsername = ghUser.login;
    const avatarUrl = ghUser.avatar_url;
    // GitHub API might not return email if it's private, fallback to a local generated email
    const email = ghUser.email || `${githubUsername}@github.local`;

    // 3. Find or create user
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { profile: { githubUsername: githubUsername } },
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      // Create a new user
      const dummyPassword = await bcrypt.hash(
        crypto.randomBytes(16).toString('hex'),
        10,
      );
      user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: dummyPassword,
          profile: {
            create: {
              fullName: githubUsername,
              githubUsername: githubUsername,
              avatarUrl: avatarUrl,
            },
          },
        },
        include: { profile: true },
      });
    } else {
      // Update existing user with github username if missing
      if (!user.profile?.githubUsername) {
        await this.prisma.profile.update({
          where: { userId: user.id },
          data: {
            githubUsername,
            ...(avatarUrl && !user.profile?.avatarUrl ? { avatarUrl } : {}),
          },
        });
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }


  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

    private async sendOtpEmail(email: string, code: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    try {
      const fromEmail = this.configService.get<string>('SMTP_FROM', 'noreply@teamup.local');
      await transporter.sendMail({
        from: `"TeamUp Verification" <${fromEmail}>`,
        to: email,
        subject: 'Your TeamUp Verification Code',
        text: `Your TeamUp verification code is: ${code}. It will expire in 15 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>TeamUp Verification</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #4A90E2; letter-spacing: 5px;">${code}</h1>
            <p>It will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
      console.log(`[EMAIL SERVICE] OTP successfully sent to ${email}`);
    } catch (error) {
      console.error(`[EMAIL SERVICE] Failed to send OTP to ${email}: `, error);
      // We log but don't throw, to prevent blocking if email service goes down temporarily, 
      // but in production we'd want a proper dead-letter queue or retry mechanism.
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const accessSecret = this.configService.get<string>(
      'JWT_SECRET',
      'super_secret_jwt_access_key_teamup_2026',
    );
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'super_secret_jwt_refresh_key_teamup_2026',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId, jti: crypto.randomUUID() },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  
  async register(dto: RegisterDto): Promise<{ message: string; email: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      if (!existing.isVerified) {
        const otpCode = this.generateOtp();
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { otpCode, otpExpiresAt },
        });
        await this.sendOtpEmail(existing.email, otpCode);
        return { message: 'Verification code sent', email: existing.email };
      }
      throw new ConflictException('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const fullName = dto.fullName?.trim() || dto.email.split('@')[0];
    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        isVerified: false,
        otpCode,
        otpExpiresAt,
        profile: {
          create: {
            fullName,
          },
        },
      },
    });

    await this.sendOtpEmail(user.email, otpCode);
    return { message: 'Registration successful. Verification code sent.', email: user.email };
  }

  
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      const otpCode = this.generateOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiresAt },
      });
      await this.sendOtpEmail(user.email, otpCode);
      throw new UnauthorizedException('ACCOUNT_NOT_VERIFIED');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  
  async verifyOtp(dto: { email: string; code: string }): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    if (user.otpCode !== dto.code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('Verification code expired');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    const tokens = await this.generateTokens(updatedUser.id, updatedUser.email, updatedUser.role);

    return {
      tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    };
  }

  async resendOtp(dto: { email: string }): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiresAt },
    });

    await this.sendOtpEmail(user.email, otpCode);
    return { message: 'Verification code resent successfully' };
  }

  async refreshTokens(dto: RefreshTokenDto): Promise<{ tokens: AuthTokens }> {
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'super_secret_jwt_refresh_key_teamup_2026',
    );

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Invalid refresh token (reused or revoked)',
      );
    }

    // Revoke the old token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return { tokens };
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          tokenHash,
        },
      });
    } else {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    return { message: 'Logged out successfully' };
  }
}

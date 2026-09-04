import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should register a user', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const expected = {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: '1', email: dto.email, role: 'STUDENT' },
    };
    mockAuthService.register.mockResolvedValue(expected);

    const result = await controller.register(dto);
    expect(result).toEqual(expected);
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });

  it('should log in a user', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const expected = {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: '1', email: dto.email, role: 'STUDENT' },
    };
    mockAuthService.login.mockResolvedValue(expected);

    const result = await controller.login(dto);
    expect(result).toEqual(expected);
    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('should refresh tokens', async () => {
    const dto = { refreshToken: 'valid_refresh_token' };
    const expected = { tokens: { accessToken: 'new_a', refreshToken: 'new_r' } };
    mockAuthService.refreshTokens.mockResolvedValue(expected);

    const result = await controller.refresh(dto);
    expect(result).toEqual(expected);
    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(dto);
  });

  it('should log out a user', async () => {
    mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });
    const user = { userId: '1', email: 'test@example.com', role: 'STUDENT' as any };

    const result = await controller.logout(user, { refreshToken: 'rt' });
    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(mockAuthService.logout).toHaveBeenCalledWith('1', 'rt');
  });

  it('should return the current user for getMe', async () => {
    const user = { userId: '1', email: 'test@example.com', role: 'STUDENT' as any };
    const result = await controller.getMe(user);
    expect(result).toEqual(user);
  });
});

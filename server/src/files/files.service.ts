import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

@Injectable()
export class FilesService {
  private readonly uploadDir: string;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Code
    'text/javascript',
    'text/html',
    'text/css',
    'application/json',
    'application/xml',
  ];

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        await mkdirAsync(this.uploadDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  /**
   * Verify user is a member of the project
   */
  private async verifyProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a project member to access files',
      );
    }
  }

  /**
   * Validate file upload
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (file.originalname && file.originalname.toLowerCase().endsWith('.exe')) {
      throw new BadRequestException('Executable files are not allowed');
    }

    if (file.buffer && file.buffer.length >= 2) {
      // Check for DOS/Windows PE executable magic bytes: MZ
      if (file.buffer[0] === 0x4d && file.buffer[1] === 0x5a) {
        throw new BadRequestException(
          'Executable files disguised as images are not allowed',
        );
      }
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
  }

  /**
   * Upload a file to a project
   */
  async uploadFile(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    await this.verifyProjectMembership(projectId, userId);
    this.validateFile(file);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    const filePath = path.join(this.uploadDir, uniqueFilename);

    // Save file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Save metadata to database
    const projectFile = await this.prisma.projectFile.create({
      data: {
        projectId,
        uploaderId: userId,
        fileName: file.originalname,
        fileUrl: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    const { fileUrl, ...safeFile } = projectFile;
    return safeFile;
  }

  /**
   * Get all files for a project
   */
  async getProjectFiles(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    const files = await this.prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return files.map(({ fileUrl, ...rest }) => rest);
  }

  /**
   * Get a single file's metadata
   */
  async getFile(fileId: string, userId: string, includeUrl = false) {
    const file = await this.prisma.projectFile.findUnique({
      where: { id: fileId },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException(`File with ID '${fileId}' not found`);
    }

    await this.verifyProjectMembership(file.projectId, userId);

    if (!includeUrl) {
      const { fileUrl, ...safeFile } = file;
      return safeFile as any;
    }

    return file;
  }

  /**
   * Get file path for download
   */
  async getFilePath(fileId: string, userId: string): Promise<string> {
    const file = await this.getFile(fileId, userId, true);

    // Check if file exists on disk
    if (!fs.existsSync(file.fileUrl)) {
      throw new NotFoundException('File not found on disk');
    }

    return file.fileUrl;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, userId: string) {
    const file = await this.prisma.projectFile.findUnique({
      where: { id: fileId },
      include: { project: true },
    });

    if (!file) {
      throw new NotFoundException(`File with ID '${fileId}' not found`);
    }

    await this.verifyProjectMembership(file.projectId, userId);

    // Only uploader or project leader can delete
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId: file.projectId,
        userId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (file.uploaderId !== userId && membership?.role !== 'LEADER') {
      throw new ForbiddenException(
        'Only the file uploader or project leader can delete this file',
      );
    }

    // Delete from disk
    if (fs.existsSync(file.fileUrl)) {
      await unlinkAsync(file.fileUrl);
    }

    // Delete from database
    await this.prisma.projectFile.delete({
      where: { id: fileId },
    });

    return { message: 'File deleted successfully' };
  }

  /**
   * Get storage statistics for a project
   */
  async getProjectStorageStats(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    const stats = await this.prisma.projectFile.aggregate({
      where: { projectId },
      _sum: { fileSize: true },
      _count: { id: true },
    });

    return {
      totalFiles: stats._count.id,
      totalSizeBytes: stats._sum.fileSize ?? 0,
      totalSizeMB: ((stats._sum.fileSize ?? 0) / (1024 * 1024)).toFixed(2),
    };
  }
}

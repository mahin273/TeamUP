import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as path from 'path';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('projects/:id/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Upload a file to a project
   * POST /projects/:id/files
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const uploadedFile = await this.filesService.uploadFile(
      projectId,
      user.userId,
      file,
    );

    return {
      success: true,
      data: uploadedFile,
    };
  }

  /**
   * Get all files for a project
   * GET /projects/:id/files
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getProjectFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    const files = await this.filesService.getProjectFiles(
      projectId,
      user.userId,
    );

    return {
      success: true,
      data: files,
    };
  }

  /**
   * Get file metadata
   * GET /files/:fileId
   */
  @Get(':fileId')
  @UseGuards(JwtAuthGuard)
  async getFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileId') fileId: string,
  ) {
    const file = await this.filesService.getFile(fileId, user.userId);

    return {
      success: true,
      data: file,
    };
  }

  /**
   * Download a file
   * GET /files/:fileId/download
   */
  @Get(':fileId/download')
  @UseGuards(JwtAuthGuard)
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    try {
      const file = await this.filesService.getFile(fileId, user.userId);
      if (projectId && file.projectId !== projectId) {
        throw new NotFoundException('File does not belong to this project');
      }
      const filePath = await this.filesService.getFilePath(
        fileId,
        user.userId,
      );

      // Set headers for file download
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName}"`,
      );
      res.setHeader('Content-Length', file.fileSize);

      // Stream the file
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);
      res.sendFile(absolutePath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              success: false,
              error: 'Error downloading file',
            });
          }
        }
      });
    } catch (error) {
      const status =
        error.status ||
        (typeof error.getStatus === 'function' ? error.getStatus() : 404);
      res.status(status).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Delete a file
   * DELETE /files/:fileId
   */
  @Delete(':fileId')
  @UseGuards(JwtAuthGuard)
  async deleteFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileId') fileId: string,
  ) {
    const result = await this.filesService.deleteFile(fileId, user.userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get storage statistics for a project
   * GET /projects/:id/files/stats
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStorageStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    const stats = await this.filesService.getProjectStorageStats(
      projectId,
      user.userId,
    );

    return {
      success: true,
      data: stats,
    };
  }
}

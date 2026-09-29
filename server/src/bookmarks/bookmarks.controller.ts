import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import {
  CreateBookmarkDto,
  BookmarkFilterDto,
} from './dto/create-bookmark.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { BookmarkType } from '@prisma/client';

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  /**
   * Get all bookmarks for the authenticated user
   */
  @Get()
  async getMyBookmarks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BookmarkFilterDto,
  ) {
    return this.bookmarksService.getUserBookmarks(user.userId, filter.type);
  }

  /**
   * Get list of bookmarked target IDs for rapid client icon hydration
   */
  @Get('ids')
  async getMyBookmarkedIds(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BookmarkFilterDto,
  ) {
    return this.bookmarksService.getUserBookmarkedIds(user.userId, filter.type);
  }

  /**
   * Add a bookmark
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.bookmarksService.addBookmark(
      user.userId,
      dto.targetType,
      dto.targetId,
    );
  }

  /**
   * Toggle a bookmark
   */
  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  async toggleBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.bookmarksService.toggleBookmark(
      user.userId,
      dto.targetType,
      dto.targetId,
    );
  }

  /**
   * Remove a bookmark by targetType and targetId
   */
  @Delete(':targetType/:targetId')
  async removeBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType') targetType: BookmarkType,
    @Param('targetId') targetId: string,
  ) {
    return this.bookmarksService.removeBookmark(
      user.userId,
      targetType,
      targetId,
    );
  }

  /**
   * Remove a bookmark by its primary ID
   */
  @Delete(':id')
  async deleteBookmarkById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.bookmarksService.deleteBookmarkById(user.userId, id);
  }
}

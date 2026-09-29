import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from './dto/register-push-token.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get total unread count for badges
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  /**
   * Get notifications for authenticated user
   */
  @Get()
  async getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    const { notifications, meta } =
      await this.notificationsService.getUserNotifications(user.userId, query);
    return Object.assign(notifications, { meta });
  }

  /**
   * Mark all unread notifications as read
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.userId);
  }

  /**
   * Mark single notification as read
   */
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.userId, id);
  }

  /**
   * Register a mobile device push token
   */
  @Post('push-token')
  @HttpCode(HttpStatus.CREATED)
  async registerPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user.userId, dto);
  }

  /**
   * Unregister mobile device push token
   */
  @Delete('push-token')
  @HttpCode(HttpStatus.OK)
  async unregisterPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    return this.notificationsService.unregisterPushToken(
      user.userId,
      dto.token || dto.pushToken || '',
    );
  }

  /**
   * Delete single notification
   */
  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(user.userId, id);
  }
}

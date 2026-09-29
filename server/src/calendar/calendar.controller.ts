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
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { CalendarFeedQueryDto } from './dto/calendar-feed-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller()
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * Get unified calendar aggregator feed across active projects
   */
  @Get(['calendar/feed', 'calendar'])
  async getUnifiedFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarFeedQueryDto,
  ) {
    return this.calendarService.getUnifiedFeed(user.userId, query);
  }

  /**
   * Create a new project calendar event (Meeting, Deadline, Milestone)
   */
  @Post(['projects/:projectId/calendar/events', 'projects/:projectId/calendar'])
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.createEvent(user.userId, projectId, dto);
  }

  /**
   * Get calendar events for a specific project
   */
  @Get(['projects/:projectId/calendar/events', 'projects/:projectId/calendar'])
  async getProjectEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query() query: CalendarFeedQueryDto,
  ) {
    return this.calendarService.getProjectEvents(user.userId, projectId, query);
  }

  /**
   * Get single calendar event details
   */
  @Get('calendar/events/:id')
  async getEventById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.calendarService.getEventById(user.userId, id);
  }

  /**
   * Delete calendar event (Leader or Creator only)
   */
  @Delete('calendar/events/:id')
  @HttpCode(HttpStatus.OK)
  async deleteEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.calendarService.deleteEvent(user.userId, id);
  }
}

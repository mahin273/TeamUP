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
import { ProjectsService } from './projects.service';
import { MatchingService } from '../matching/matching.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectFilterDto } from './dto/project-filter.dto';
import { InviteMemberDto, UpdateMemberDto } from './dto/manage-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { BookmarkType } from '@prisma/client';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly matchingService: MatchingService,
    private readonly bookmarksService: BookmarksService,
  ) {}

  /**
   * Create a new project listing
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(user.userId, dto);
  }

  /**
   * Search projects (Design Doc section 5.1: GET /projects/search)
   */
  @Get('search')
  async searchProjects(@Query() query: ProjectFilterDto) {
    return this.projectsService.search(query);
  }

  /**
   * List / filter all projects
   */
  @Get()
  async getProjects(@Query() query: ProjectFilterDto) {
    return this.projectsService.findAll(query);
  }

  /**
   * Get user's bookmarked project listings (matches client bookmarkService.ts)
   */
  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  async getBookmarkedProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.bookmarksService.getBookmarkedProjects(user.userId);
  }

  /**
   * Get project details by ID
   */
  @Get(':id')
  async getProjectById(@Param('id') id: string) {
    return this.projectsService.findById(id);
  }

  /**
   * Get ranked teammate recommendations for project (Design Doc §4.1)
   */
  @Get(':id/recommendations')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchingService.getRecommendations(id, user.userId);
  }

  /**
   * Bookmark a project (matches client bookmarkService.ts)
   */
  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bookmarkProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookmarksService.addBookmark(
      user.userId,
      BookmarkType.PROJECT,
      id,
    );
  }

  /**
   * Remove bookmark for a project (matches client bookmarkService.ts)
   */
  @Delete(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  async removeProjectBookmark(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookmarksService.removeBookmark(
      user.userId,
      BookmarkType.PROJECT,
      id,
    );
  }

  /**
   * Update project details or status (Leader only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(id, user.userId, dto);
  }

  /**
   * Delete project (Leader only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.deleteProject(id, user.userId);
  }

  /**
   * Apply to join project
   */
  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async applyToProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.applyToProject(id, user.userId);
  }

  /**
   * Alias: Apply to join project via /join
   */
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async joinProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.applyToProject(id, user.userId);
  }

  /**
   * Invite a user to project (Leader only)
   */
  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projectsService.inviteMember(id, user.userId, dto);
  }

  /**
   * Get all members for a project
   */
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getProjectMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getProjectMembers(id, user.userId);
  }

  /**
   * Update member status or role (Accept/Reject/Promote) (Leader only)
   */
  @Patch(':id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  async updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.projectsService.updateMember(id, memberId, user.userId, dto);
  }

  /**
   * Remove member or leave project
   */
  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectsService.removeMember(id, memberId, user.userId);
  }
}

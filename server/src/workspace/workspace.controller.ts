import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Get team workspace overview, metrics, and recent activities
   * Protected by both JwtAuthGuard and ProjectMemberGuard
   */
  @Get(['projects/:id/workspace'])
  @UseGuards(JwtAuthGuard, ProjectMemberGuard)
  async getWorkspaceOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    return this.workspaceService.getWorkspaceOverview(projectId, user.userId);
  }

  /**
   * Get all tasks for the project (Kanban board)
   * GET /projects/:id/tasks or /projects/:id/workspace/tasks
   */
  @Get(['projects/:id/tasks', 'projects/:id/workspace/tasks'])
  @UseGuards(JwtAuthGuard)
  async getProjectTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    return this.workspaceService.getProjectTasks(projectId, user.userId);
  }

  /**
   * Create a new task
   * POST /projects/:id/tasks or /projects/:id/workspace/tasks
   */
  @Post(['projects/:id/tasks', 'projects/:id/workspace/tasks'])
  @UseGuards(JwtAuthGuard)
  async createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.workspaceService.createTask(projectId, user.userId, dto);
  }

  /**
   * Update a task
   * PATCH /workspace/tasks/:taskId or /tasks/:taskId
   */
  @Patch([
    'workspace/tasks/:taskId',
    'tasks/:taskId',
    'projects/:id/workspace/tasks/:taskId',
    'projects/:id/tasks/:taskId',
  ])
  @UseGuards(JwtAuthGuard)
  async updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.workspaceService.updateTask(taskId, user.userId, dto);
  }

  /**
   * Delete a task
   * DELETE /workspace/tasks/:taskId or /tasks/:taskId
   */
  @Delete([
    'workspace/tasks/:taskId',
    'tasks/:taskId',
    'projects/:id/workspace/tasks/:taskId',
    'projects/:id/tasks/:taskId',
  ])
  @UseGuards(JwtAuthGuard)
  async deleteTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.workspaceService.deleteTask(taskId, user.userId);
  }
}

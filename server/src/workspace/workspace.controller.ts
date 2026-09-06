import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('projects/:id/workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Get team workspace overview, metrics, and recent activities
   * Protected by both JwtAuthGuard and ProjectMemberGuard
   */
  @Get()
  @UseGuards(JwtAuthGuard, ProjectMemberGuard)
  async getWorkspaceOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    return this.workspaceService.getWorkspaceOverview(projectId, user.userId);
  }
}

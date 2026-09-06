import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, ProjectMemberGuard],
  exports: [WorkspaceService, ProjectMemberGuard],
})
export class WorkspaceModule {}

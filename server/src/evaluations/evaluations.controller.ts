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
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller('projects/:id/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  /**
   * Create a peer evaluation
   * POST /projects/:id/evaluations
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body() dto: CreateEvaluationDto,
  ) {
    const evaluation = await this.evaluationsService.createEvaluation(
      projectId,
      user.userId,
      dto,
    );

    return {
      success: true,
      data: evaluation,
    };
  }

  /**
   * Get all evaluations for a project
   * GET /projects/:id/evaluations
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getProjectEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    const evaluations = await this.evaluationsService.getProjectEvaluations(
      projectId,
      user.userId,
    );

    return {
      success: true,
      data: evaluations,
    };
  }

  /**
   * Get evaluation summary for all project members
   * GET /projects/:id/evaluations/summary
   */
  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async getProjectEvaluationSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    const summary = await this.evaluationsService.getProjectEvaluationSummary(
      projectId,
      user.userId,
    );

    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get evaluations for a specific user in a project
   * GET /projects/:id/evaluations/user/:userId
   */
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('userId') evaluateeId: string,
  ) {
    const evaluations = await this.evaluationsService.getUserEvaluations(
      projectId,
      evaluateeId,
      user.userId,
    );

    return {
      success: true,
      data: evaluations,
    };
  }

  /**
   * Get evaluation statistics for a user
   * GET /projects/:id/evaluations/user/:userId/stats
   */
  @Get('user/:userId/stats')
  @UseGuards(JwtAuthGuard)
  async getUserEvaluationStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('userId') evaluateeId: string,
  ) {
    const stats = await this.evaluationsService.getUserEvaluationStats(
      projectId,
      evaluateeId,
      user.userId,
    );

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Get evaluations given by the current user
   * GET /projects/:id/evaluations/my-evaluations
   */
  @Get('my-evaluations')
  @UseGuards(JwtAuthGuard)
  async getMyEvaluations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
  ) {
    const evaluations = await this.evaluationsService.getEvaluationsByEvaluator(
      projectId,
      user.userId,
      user.userId,
    );

    return {
      success: true,
      data: evaluations,
    };
  }

  /**
   * Update an evaluation (within 24 hours)
   * PATCH /evaluations/:evaluationId
   */
  @Patch(':evaluationId')
  @UseGuards(JwtAuthGuard)
  async updateEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('evaluationId') evaluationId: string,
    @Body() dto: Partial<CreateEvaluationDto>,
  ) {
    const updated = await this.evaluationsService.updateEvaluation(
      evaluationId,
      user.userId,
      dto,
    );

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Delete an evaluation (within 1 hour)
   * DELETE /evaluations/:evaluationId
   */
  @Delete(':evaluationId')
  @UseGuards(JwtAuthGuard)
  async deleteEvaluation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('evaluationId') evaluationId: string,
  ) {
    const result = await this.evaluationsService.deleteEvaluation(
      evaluationId,
      user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }
}

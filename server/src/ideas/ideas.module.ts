import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';
import { AiIdeaService } from './ai-idea.service';
import { LlmClient } from './llm.client';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [IdeasController],
  providers: [IdeasService, AiIdeaService, LlmClient],
  exports: [IdeasService, AiIdeaService, LlmClient],
})
export class IdeasModule {}

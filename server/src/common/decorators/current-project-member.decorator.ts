import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectMember } from '@prisma/client';

export const CurrentProjectMember = createParamDecorator(
  (data: keyof ProjectMember | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const member: ProjectMember = request.projectMember;
    if (!member) {
      return null;
    }
    return data ? member[data] : member;
  },
);

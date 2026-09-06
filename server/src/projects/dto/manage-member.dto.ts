import { IsOptional, IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { MemberStatus, ProjectRole } from '@prisma/client';

export class InviteMemberDto {
  @IsString({ message: 'userId must be a string' })
  @IsNotEmpty({ message: 'userId is required' })
  userId: string;

  @IsOptional()
  @IsEnum(ProjectRole, { message: 'role must be LEADER or MEMBER' })
  role?: ProjectRole;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MemberStatus, {
    message: 'status must be PENDING, ACCEPTED, or REJECTED',
  })
  status?: MemberStatus;

  @IsOptional()
  @IsEnum(ProjectRole, { message: 'role must be LEADER or MEMBER' })
  role?: ProjectRole;
}

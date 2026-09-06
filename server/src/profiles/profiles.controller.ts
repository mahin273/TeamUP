import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddProfileSkillDto } from './dto/add-profile-skill.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyProfile(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.upsertProfile(user.userId, user.email, dto);
  }

  @Post('me/skills')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddProfileSkillDto,
  ) {
    return this.profilesService.addSkillToProfile(user.userId, user.email, dto);
  }

  @Delete('me/skills/:skillId')
  @UseGuards(JwtAuthGuard)
  async removeSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('skillId') skillId: string,
  ) {
    return this.profilesService.removeSkillFromProfile(user.userId, skillId);
  }

  @Get(':id')
  async getProfileById(@Param('id') id: string) {
    return this.profilesService.getProfileById(id);
  }
}

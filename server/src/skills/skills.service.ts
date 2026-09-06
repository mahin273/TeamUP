import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(category?: string, query?: string) {
    const where: any = {};

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (query) {
      where.name = { contains: query, mode: 'insensitive' };
    }

    return this.prisma.skill.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  async create(dto: CreateSkillDto) {
    const normalizedName = dto.name.trim();

    const existing = await this.prisma.skill.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new ConflictException(`Skill '${normalizedName}' already exists`);
    }

    return this.prisma.skill.create({
      data: {
        name: normalizedName,
        category: dto.category?.trim(),
      },
    });
  }
}

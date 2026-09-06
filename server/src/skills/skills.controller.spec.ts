import { Test, TestingModule } from '@nestjs/testing';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

describe('SkillsController', () => {
  let controller: SkillsController;

  const mockSkillsService = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillsController],
      providers: [{ provide: SkillsService, useValue: mockSkillsService }],
    }).compile();

    controller = module.get<SkillsController>(SkillsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll with query parameters', async () => {
    const mockSkills = [{ id: 's-1', name: 'TypeScript' }];
    mockSkillsService.findAll.mockResolvedValue(mockSkills);

    const result = await controller.findAll('Language', 'Type');
    expect(result).toEqual(mockSkills);
    expect(mockSkillsService.findAll).toHaveBeenCalledWith('Language', 'Type');
  });

  it('should call create with dto', async () => {
    const dto = { name: 'Rust', category: 'Language' };
    const created = { id: 's-2', ...dto };
    mockSkillsService.create.mockResolvedValue(created);

    const result = await controller.create(dto);
    expect(result).toEqual(created);
    expect(mockSkillsService.create).toHaveBeenCalledWith(dto);
  });
});

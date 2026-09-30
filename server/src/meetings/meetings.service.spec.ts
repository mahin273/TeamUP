import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsService } from './meetings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  MeetingStatus,
  MemberStatus,
  ProjectRole,
  EventType,
} from '@prisma/client';

describe('MeetingsService', () => {
  let service: MeetingsService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    meeting: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    meetingVote: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    calendarEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  };

  const mockNotificationsService = {
    notifyUser: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMeeting', () => {
    const futureDate1 = new Date(Date.now() + 86400000).toISOString();
    const futureDate2 = new Date(Date.now() + 90000000).toISOString();
    const futureDate3 = new Date(Date.now() + 172800000).toISOString();
    const futureDate4 = new Date(Date.now() + 176400000).toISOString();

    const validDto = {
      title: 'Sprint Planning',
      description: 'Review backlog and pick sprint items',
      slots: [
        { startTime: futureDate1, endTime: futureDate2 },
        { startTime: futureDate3, endTime: futureDate4 },
      ],
    };

    it('should successfully propose meeting with candidate slots and notify members', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'user-creator',
        members: [
          { userId: 'user-creator', status: MemberStatus.ACCEPTED },
          { userId: 'user-member-2', status: MemberStatus.ACCEPTED },
        ],
      });

      mockPrismaService.projectMember.findMany.mockResolvedValue([
        { userId: 'user-member-2' },
      ]);

      const createdMeeting = {
        id: 'meet-1',
        projectId: 'proj-1',
        title: validDto.title,
        description: validDto.description,
        status: MeetingStatus.VOTING,
        slots: [
          {
            id: 'slot-1',
            startTime: new Date(futureDate1),
            endTime: new Date(futureDate2),
            votes: [],
          },
          {
            id: 'slot-2',
            startTime: new Date(futureDate3),
            endTime: new Date(futureDate4),
            votes: [],
          },
        ],
      };
      mockPrismaService.meeting.create.mockResolvedValue(createdMeeting);

      const result = await service.createMeeting(
        'user-creator',
        'proj-1',
        validDto,
      );

      expect(result).toEqual(createdMeeting);
      expect(mockPrismaService.meeting.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.notifyUser).toHaveBeenCalledWith(
        'user-member-2',
        expect.objectContaining({
          type: 'MEETING_VOTING',
        }),
      );
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.createMeeting('u-1', 'nonexistent', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not accepted project member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'user-creator',
        members: [{ userId: 'other-user', status: MemberStatus.ACCEPTED }],
      });

      await expect(
        service.createMeeting('outsider-user', 'proj-1', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no slots are provided', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'u-1',
        members: [{ userId: 'u-1', status: MemberStatus.ACCEPTED }],
      });

      await expect(
        service.createMeeting('u-1', 'proj-1', {
          title: 'Solo Slot',
          slots: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startTime >= endTime', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'u-1',
        members: [{ userId: 'u-1', status: MemberStatus.ACCEPTED }],
      });

      await expect(
        service.createMeeting('u-1', 'proj-1', {
          title: 'Invalid Slot Times',
          slots: [
            { startTime: futureDate2, endTime: futureDate1 },
            { startTime: futureDate3, endTime: futureDate4 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if slots are in the past', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'u-1',
        members: [{ userId: 'u-1', status: MemberStatus.ACCEPTED }],
      });

      const pastStart = new Date(Date.now() - 3600000).toISOString();
      const pastEnd = new Date(Date.now() - 1800000).toISOString();

      await expect(
        service.createMeeting('u-1', 'proj-1', {
          title: 'Past Slot',
          slots: [
            { startTime: pastStart, endTime: pastEnd },
            { startTime: futureDate3, endTime: futureDate4 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('voteSlots & auto-finalization', () => {
    const mockMeeting = {
      id: 'meet-1',
      projectId: 'proj-1',
      status: MeetingStatus.VOTING,
      project: {
        id: 'proj-1',
        creatorId: 'user-1',
        members: [
          { userId: 'user-1', status: MemberStatus.ACCEPTED },
          { userId: 'user-2', status: MemberStatus.ACCEPTED },
        ],
      },
      slots: [
        {
          id: 'slot-1',
          startTime: new Date('2026-10-01T10:00:00Z'),
          endTime: new Date('2026-10-01T11:00:00Z'),
          votes: [],
        },
        {
          id: 'slot-2',
          startTime: new Date('2026-10-01T14:00:00Z'),
          endTime: new Date('2026-10-01T15:00:00Z'),
          votes: [],
        },
      ],
    };

    it('should record votes and replace prior votes when meeting remains in VOTING', async () => {
      mockPrismaService.meeting.findUnique
        .mockResolvedValueOnce(mockMeeting) // in voteSlots
        .mockResolvedValueOnce({ ...mockMeeting }); // in getMeetingById

      mockPrismaService.meetingVote.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.meetingVote.createMany.mockResolvedValue({ count: 1 });

      // Total members = 2; only 1 has voted so far
      mockPrismaService.meetingVote.findMany.mockResolvedValue([
        { userId: 'user-1' },
      ]);

      const result = await service.voteSlots('user-1', 'meet-1', {
        slotIds: ['slot-1'],
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.meetingVote.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          slotId: { in: ['slot-1', 'slot-2'] },
        },
      });
      expect(mockPrismaService.meetingVote.createMany).toHaveBeenCalledWith({
        data: [{ slotId: 'slot-1', userId: 'user-1' }],
      });
    });

    it('should trigger auto-finalization when all accepted members have voted', async () => {
      const meetingForFinalize = {
        ...mockMeeting,
        slots: [
          {
            id: 'slot-1',
            startTime: new Date('2026-10-01T10:00:00Z'),
            endTime: new Date('2026-10-01T11:00:00Z'),
            votes: [{ userId: 'user-1' }, { userId: 'user-2' }],
          },
          {
            id: 'slot-2',
            startTime: new Date('2026-10-01T14:00:00Z'),
            endTime: new Date('2026-10-01T15:00:00Z'),
            votes: [],
          },
        ],
      };

      mockPrismaService.meeting.findUnique
        .mockResolvedValueOnce(mockMeeting) // in voteSlots check
        .mockResolvedValueOnce(meetingForFinalize); // in finalizeMeeting

      mockPrismaService.meetingVote.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.meetingVote.createMany.mockResolvedValue({ count: 1 });

      // Total members = 2; both user-1 and user-2 voted
      mockPrismaService.meetingVote.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const confirmedMeeting = {
        ...meetingForFinalize,
        status: MeetingStatus.CONFIRMED,
        selectedSlotId: 'slot-1',
      };
      mockPrismaService.meeting.update.mockResolvedValue(confirmedMeeting);
      mockPrismaService.calendarEvent.create.mockResolvedValue({ id: 'cal-1' });

      const result = await service.voteSlots('user-2', 'meet-1', {
        slotIds: ['slot-1'],
      });

      expect(result.status).toBe(MeetingStatus.CONFIRMED);
      expect(mockPrismaService.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          eventType: EventType.MEETING,
          startDate: meetingForFinalize.slots[0].startTime,
        }),
      });
      expect(mockNotificationsService.notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'MEETING_CONFIRMED' }),
      );
    });

    it('should throw BadRequestException if meeting is already CONFIRMED', async () => {
      mockPrismaService.meeting.findUnique.mockResolvedValue({
        ...mockMeeting,
        status: MeetingStatus.CONFIRMED,
      });

      await expect(
        service.voteSlots('user-1', 'meet-1', { slotIds: ['slot-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invalid slot ID is submitted', async () => {
      mockPrismaService.meeting.findUnique.mockResolvedValue(mockMeeting);

      await expect(
        service.voteSlots('user-1', 'meet-1', { slotIds: ['foreign-slot-99'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if voter is not an accepted project member', async () => {
      mockPrismaService.meeting.findUnique.mockResolvedValue(mockMeeting);

      await expect(
        service.voteSlots('stranger-user', 'meet-1', { slotIds: ['slot-1'] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('finalizeMeeting tie-breaking logic', () => {
    it('should deterministically break tie by picking slot with earliest startTime', async () => {
      const earlierSlot = {
        id: 'slot-early',
        startTime: new Date('2026-10-01T09:00:00Z'),
        endTime: new Date('2026-10-01T10:00:00Z'),
        votes: [{ userId: 'u1' }], // 1 vote
      };
      const laterSlot = {
        id: 'slot-late',
        startTime: new Date('2026-10-01T15:00:00Z'),
        endTime: new Date('2026-10-01T16:00:00Z'),
        votes: [{ userId: 'u2' }], // 1 vote (tied!)
      };

      const tiedMeeting = {
        id: 'meet-tie',
        projectId: 'proj-1',
        title: 'Tie Test Sync',
        status: MeetingStatus.VOTING,
        project: {
          id: 'proj-1',
          creatorId: 'user-1',
          members: [
            { userId: 'user-1', status: MemberStatus.ACCEPTED },
            { userId: 'user-2', status: MemberStatus.ACCEPTED },
          ],
        },
        slots: [laterSlot, earlierSlot], // order in array shouldn't matter
      };

      mockPrismaService.meeting.findUnique.mockResolvedValue(tiedMeeting);
      mockPrismaService.meeting.update.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          ...tiedMeeting,
          status: data.status,
          selectedSlotId: data.selectedSlotId,
        });
      });
      mockPrismaService.calendarEvent.create.mockResolvedValue({
        id: 'cal-tie',
      });

      const result = await service.finalizeMeeting('meet-tie');

      // Must pick slot-early because its startTime is 09:00:00 vs 15:00:00
      expect(result.selectedSlotId).toBe('slot-early');
      expect(mockPrismaService.calendarEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startDate: earlierSlot.startTime,
          endDate: earlierSlot.endTime,
        }),
      });
    });
  });

  describe('manualFinalize', () => {
    it('should allow project leader to manually finalize a meeting', async () => {
      const meeting = {
        id: 'meet-manual',
        status: MeetingStatus.VOTING,
        project: {
          creatorId: 'leader-1',
          members: [
            {
              userId: 'leader-1',
              role: ProjectRole.LEADER,
              status: MemberStatus.ACCEPTED,
            },
          ],
        },
        slots: [
          {
            id: 'slot-1',
            startTime: new Date('2026-10-01T10:00:00Z'),
            endTime: new Date('2026-10-01T11:00:00Z'),
            votes: [],
          },
        ],
      };

      mockPrismaService.meeting.findUnique
        .mockResolvedValueOnce(meeting) // in manualFinalize check
        .mockResolvedValueOnce(meeting); // in finalizeMeeting

      mockPrismaService.meeting.update.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.CONFIRMED,
        selectedSlotId: 'slot-1',
      });
      mockPrismaService.calendarEvent.create.mockResolvedValue({ id: 'cal-1' });

      const result = await service.manualFinalize('leader-1', 'meet-manual', {
        slotId: 'slot-1',
      });

      expect(result.status).toBe(MeetingStatus.CONFIRMED);
      expect(result.selectedSlotId).toBe('slot-1');
    });

    it('should throw ForbiddenException if non-leader attempts manual finalization', async () => {
      const meeting = {
        id: 'meet-manual',
        status: MeetingStatus.VOTING,
        project: {
          creatorId: 'leader-1',
          members: [
            {
              userId: 'member-2',
              role: ProjectRole.MEMBER,
              status: MemberStatus.ACCEPTED,
            },
          ],
        },
      };

      mockPrismaService.meeting.findUnique.mockResolvedValue(meeting);

      await expect(
        service.manualFinalize('member-2', 'meet-manual', {
          slotId: 'slot-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if meeting not found', async () => {
      mockPrismaService.meeting.findUnique.mockResolvedValue(null);

      await expect(
        service.manualFinalize('leader-1', 'ghost-meet'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelMeeting', () => {
    it('should cancel meeting in VOTING status by project leader', async () => {
      const meeting = {
        id: 'meet-cancel',
        status: MeetingStatus.VOTING,
        project: {
          creatorId: 'leader-1',
          members: [
            {
              userId: 'leader-1',
              role: ProjectRole.LEADER,
              status: MemberStatus.ACCEPTED,
            },
          ],
        },
      };
      mockPrismaService.meeting.findUnique.mockResolvedValue(meeting);
      mockPrismaService.meeting.update.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.CANCELLED,
      });

      const result = await service.cancelMeeting('leader-1', 'meet-cancel');

      expect(result.status).toBe(MeetingStatus.CANCELLED);
    });

    it('should throw ForbiddenException if non-leader attempts cancellation', async () => {
      const meeting = {
        id: 'meet-cancel',
        status: MeetingStatus.VOTING,
        project: {
          creatorId: 'leader-1',
          members: [
            {
              userId: 'member-2',
              role: ProjectRole.MEMBER,
              status: MemberStatus.ACCEPTED,
            },
          ],
        },
      };
      mockPrismaService.meeting.findUnique.mockResolvedValue(meeting);

      await expect(
        service.cancelMeeting('member-2', 'meet-cancel'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

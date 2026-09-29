import {
  Injectable,
  Logger,
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
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { VoteSlotsDto } from './dto/vote-slots.dto';
import { FinalizeMeetingDto } from './dto/finalize-meeting.dto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Propose a new meeting with candidate time slots
   */
  async createMeeting(
    userId: string,
    projectId: string,
    dto: CreateMeetingDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { status: MemberStatus.ACCEPTED },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isMember =
      project.creatorId === userId ||
      project.members.some((m) => m.userId === userId);

    if (!isMember) {
      throw new ForbiddenException(
        'Only accepted project members can propose meetings',
      );
    }

    const slots = dto.slots ?? dto.proposedSlots;

    if (!slots || slots.length < 1) {
      throw new BadRequestException(
        'At least 1 candidate slot must be proposed',
      );
    }

    if (slots.length > 5) {
      throw new BadRequestException(
        'Maximum 5 candidate slots can be proposed',
      );
    }

    const now = Date.now();
    for (const slot of slots) {
      const start = new Date(slot.startTime).getTime();
      const end = new Date(slot.endTime).getTime();

      if (isNaN(start) || isNaN(end)) {
        throw new BadRequestException('Invalid date format for meeting slot');
      }

      if (start >= end) {
        throw new BadRequestException(
          'Slot startTime must be strictly before endTime',
        );
      }

      if (start < now) {
        throw new BadRequestException(
          'Cannot propose meeting slots in the past',
        );
      }
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        projectId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        status: MeetingStatus.VOTING,
        slots: {
          create: slots.map((s) => ({
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
          })),
        },
      },
      include: {
        slots: {
          include: {
            votes: true,
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });

    // Notify other accepted project members
    const recipientIds = new Set(
      project.members.filter((m) => m.userId !== userId).map((m) => m.userId),
    );
    if (project.creatorId !== userId) {
      recipientIds.add(project.creatorId);
    }

    await Promise.all(
      Array.from(recipientIds).map((recipientId) =>
        this.notificationsService
          .notifyUser(recipientId, {
            title: `New Meeting Proposed: ${dto.title}`,
            body: 'Vote on your available time slots for the team meeting.',
            type: 'MEETING_VOTING',
            data: { meetingId: meeting.id, projectId },
          })
          .catch((err: Error) =>
            this.logger.warn(
              `Failed to notify member ${recipientId}: ${err.message}`,
            ),
          ),
      ),
    );

    return meeting;
  }

  /**
   * Get all meetings for a given project
   */
  async getProjectMeetings(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { status: MemberStatus.ACCEPTED },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isMember =
      project.creatorId === userId ||
      project.members.some((m) => m.userId === userId);

    if (!isMember) {
      throw new ForbiddenException(
        'You must be an active member of this project to view its meetings',
      );
    }

    return this.prisma.meeting.findMany({
      where: { projectId },
      include: {
        selectedSlot: true,
        slots: {
          include: {
            votes: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        fullName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get single meeting details with candidate slots and vote tallies
   */
  async getMeetingById(userId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          include: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
        selectedSlot: true,
        slots: {
          include: {
            votes: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        fullName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID '${meetingId}' not found`);
    }

    const isMember =
      meeting.project.creatorId === userId ||
      meeting.project.members.some((m) => m.userId === userId);

    if (!isMember) {
      throw new ForbiddenException(
        'You must be an active member of this project to view this meeting',
      );
    }

    return meeting;
  }

  /**
   * Cast votes for candidate meeting slots
   */
  async voteSlots(userId: string, meetingId: string, dto: VoteSlotsDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          include: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
        slots: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID '${meetingId}' not found`);
    }

    if (meeting.status !== MeetingStatus.VOTING) {
      throw new BadRequestException('Voting is closed for this meeting');
    }

    const isMember =
      meeting.project.creatorId === userId ||
      meeting.project.members.some((m) => m.userId === userId);

    if (!isMember) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }

    const targetStartTime = dto.slotStartTime || dto.startTime;
    const targetSlotIds: string[] =
      dto.slotIds && dto.slotIds.length > 0
        ? [...dto.slotIds]
        : dto.slotId
          ? [dto.slotId]
          : [];

    if (targetStartTime) {
      const targetTime = new Date(targetStartTime).getTime();
      const matched = meeting.slots.find(
        (s) => new Date(s.startTime).getTime() === targetTime,
      );
      if (!matched) {
        throw new BadRequestException(
          `Slot with startTime '${targetStartTime}' was not proposed for this meeting`,
        );
      }
      targetSlotIds.push(matched.id);
    }

    if (targetSlotIds.length === 0) {
      throw new BadRequestException(
        'At least one slotId or slotStartTime must be provided to vote',
      );
    }

    const uniqueSlotIds = Array.from(new Set(targetSlotIds));

    const validSlotIds = new Set(meeting.slots.map((s) => s.id));
    for (const sid of uniqueSlotIds) {
      if (!validSlotIds.has(sid)) {
        throw new BadRequestException(
          `Submitted slot ID '${sid}' does not belong to this meeting`,
        );
      }
    }

    // Atomically replace user's previous votes on this meeting's slots
    await this.prisma.$transaction(async (tx) => {
      await tx.meetingVote.deleteMany({
        where: {
          userId,
          slotId: { in: meeting.slots.map((s) => s.id) },
        },
      });

      await tx.meetingVote.createMany({
        data: uniqueSlotIds.map((slotId) => ({
          slotId,
          userId,
        })),
      });
    });

    // Check auto-consensus resolution
    const memberIds = new Set(meeting.project.members.map((m) => m.userId));
    memberIds.add(meeting.project.creatorId);
    const totalMembers = memberIds.size;

    const distinctVoters = await this.prisma.meetingVote.findMany({
      where: {
        slot: { meetingId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    if (distinctVoters.length >= totalMembers && totalMembers > 0) {
      return this.finalizeMeeting(meetingId);
    }

    return this.getMeetingById(userId, meetingId);
  }

  /**
   * Finalize a meeting by selecting the winning slot, transitioning to CONFIRMED,
   * creating a CalendarEvent, and notifying team members.
   */
  async finalizeMeeting(meetingId: string, manualSlotId?: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          include: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
        slots: {
          include: {
            votes: true,
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID '${meetingId}' not found`);
    }

    if (meeting.status !== MeetingStatus.VOTING) {
      throw new BadRequestException('Meeting is not in voting phase');
    }

    if (!meeting.slots || meeting.slots.length === 0) {
      throw new BadRequestException(
        'Meeting has no proposed slots to finalize',
      );
    }

    let winningSlot = meeting.slots[0];
    if (manualSlotId) {
      const found = meeting.slots.find((s) => s.id === manualSlotId);
      if (!found) {
        throw new BadRequestException(
          `Selected slot ID '${manualSlotId}' does not belong to this meeting`,
        );
      }
      winningSlot = found;
    } else {
      let maxVotes = -1;
      for (const slot of meeting.slots) {
        const count = slot.votes.length;
        if (count > maxVotes) {
          maxVotes = count;
          winningSlot = slot;
        } else if (count === maxVotes) {
          // Deterministic tie-breaker: earliest startTime wins
          if (
            new Date(slot.startTime).getTime() <
            new Date(winningSlot.startTime).getTime()
          ) {
            winningSlot = slot;
          }
        }
      }
    }

    const finalized = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.CONFIRMED,
          selectedSlotId: winningSlot.id,
        },
        include: {
          selectedSlot: true,
          slots: {
            include: {
              votes: true,
            },
            orderBy: {
              startTime: 'asc',
            },
          },
        },
      });

      await tx.calendarEvent.create({
        data: {
          projectId: meeting.projectId,
          title: meeting.title,
          description: meeting.description,
          eventType: EventType.MEETING,
          startDate: winningSlot.startTime,
          endDate: winningSlot.endTime,
        },
      });

      return updated;
    });

    // Notify all accepted project members
    const memberIds = new Set(meeting.project.members.map((m) => m.userId));
    memberIds.add(meeting.project.creatorId);

    const formattedDate = new Date(winningSlot.startTime).toISOString();
    await Promise.all(
      Array.from(memberIds).map((recipientId) =>
        this.notificationsService
          .notifyUser(recipientId, {
            title: `Meeting Confirmed: ${meeting.title}`,
            body: `Meeting scheduled for ${formattedDate}`,
            type: 'MEETING_CONFIRMED',
            data: {
              meetingId: meeting.id,
              projectId: meeting.projectId,
              slotId: winningSlot.id,
              startTime: winningSlot.startTime.toISOString(),
              endTime: winningSlot.endTime.toISOString(),
            },
          })
          .catch((err: Error) =>
            this.logger.warn(
              `Failed to notify member ${recipientId}: ${err.message}`,
            ),
          ),
      ),
    );

    return finalized;
  }

  /**
   * Manually finalize a meeting (Leader/Creator only)
   */
  async manualFinalize(
    userId: string,
    meetingId: string,
    dto?: FinalizeMeetingDto,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID '${meetingId}' not found`);
    }

    const isLeader =
      meeting.project.creatorId === userId ||
      meeting.project.members.some(
        (m) =>
          m.userId === userId &&
          m.role === ProjectRole.LEADER &&
          m.status === MemberStatus.ACCEPTED,
      );

    if (!isLeader) {
      throw new ForbiddenException(
        'Only project leaders or creators can manually finalize a meeting',
      );
    }

    return this.finalizeMeeting(meetingId, dto?.slotId);
  }

  /**
   * Cancel a meeting in VOTING status (Leader/Creator only)
   */
  async cancelMeeting(userId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID '${meetingId}' not found`);
    }

    if (meeting.status !== MeetingStatus.VOTING) {
      throw new BadRequestException(
        'Only meetings in VOTING status can be cancelled',
      );
    }

    const isLeader =
      meeting.project.creatorId === userId ||
      meeting.project.members.some(
        (m) =>
          m.userId === userId &&
          m.role === ProjectRole.LEADER &&
          m.status === MemberStatus.ACCEPTED,
      );

    if (!isLeader) {
      throw new ForbiddenException(
        'Only project leaders or creators can cancel a meeting',
      );
    }

    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.CANCELLED,
      },
      include: {
        slots: true,
        selectedSlot: true,
      },
    });
  }
}

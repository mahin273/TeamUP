import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookmarkType, MemberStatus } from '@prisma/client';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delete a bookmark by its primary key ID
   */
  async deleteBookmarkById(userId: string, bookmarkId: string) {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { id: bookmarkId },
    });
    if (!bookmark) {
      throw new NotFoundException(`Bookmark '${bookmarkId}' not found`);
    }
    if (bookmark.userId !== userId) {
      throw new ForbiddenException(
        "You cannot delete another user's bookmark",
      );
    }
    await this.prisma.bookmark.delete({
      where: { id: bookmarkId },
    });
    return {
      bookmarked: false,
      message: 'Bookmark removed successfully',
    };
  }

  /**
   * Validate that the referenced target entity exists in the database
   */
  async validateTargetExists(targetType: BookmarkType, targetId: string) {
    if (targetType === BookmarkType.PROJECT) {
      const project = await this.prisma.project.findUnique({
        where: { id: targetId },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID '${targetId}' not found`);
      }
      return project;
    }

    if (targetType === BookmarkType.IDEA) {
      const idea = await this.prisma.idea.findUnique({
        where: { id: targetId },
      });
      if (!idea) {
        throw new NotFoundException(`Idea with ID '${targetId}' not found`);
      }
      return idea;
    }

    throw new NotFoundException(
      `Unsupported bookmark target type '${targetType as string}'`,
    );
  }

  /**
   * Add a bookmark (Idempotent)
   */
  async addBookmark(
    userId: string,
    targetType: BookmarkType,
    targetId: string,
  ) {
    await this.validateTargetExists(targetType, targetId);

    await this.prisma.bookmark.upsert({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType,
          targetId,
        },
      },
      create: {
        userId,
        targetType,
        targetId,
      },
      update: {},
    });

    return {
      bookmarked: true,
      message: 'Bookmark added successfully',
    };
  }

  /**
   * Remove a bookmark (Idempotent)
   */
  async removeBookmark(
    userId: string,
    targetType: BookmarkType,
    targetId: string,
  ) {
    await this.prisma.bookmark.deleteMany({
      where: {
        userId,
        targetType,
        targetId,
      },
    });

    return {
      bookmarked: false,
      message: 'Bookmark removed successfully',
    };
  }

  /**
   * Toggle bookmark status for a target entity
   */
  async toggleBookmark(
    userId: string,
    targetType: BookmarkType,
    targetId: string,
  ) {
    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType,
          targetId,
        },
      },
    });

    if (existing) {
      await this.prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return {
        bookmarked: false,
        message: 'Bookmark removed successfully',
      };
    }

    await this.validateTargetExists(targetType, targetId);

    await this.prisma.bookmark.create({
      data: {
        userId,
        targetType,
        targetId,
      },
    });

    return {
      bookmarked: true,
      message: 'Bookmark added successfully',
    };
  }

  /**
   * Get all bookmarks of the current user
   */
  async getUserBookmarks(userId: string, type?: BookmarkType) {
    return this.prisma.bookmark.findMany({
      where: {
        userId,
        ...(type && { targetType: type }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get list of target IDs bookmarked by user (for rapid client-side icon hydration)
   */
  async getUserBookmarkedIds(
    userId: string,
    type?: BookmarkType,
  ): Promise<string[]> {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId,
        ...(type && { targetType: type }),
      },
      select: { targetId: true },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map((b) => b.targetId);
  }

  /**
   * Fetch hydrated bookmarked project listings for the user
   * Returns normalized ProjectListing[] with isBookmarked = true
   */
  async getBookmarkedProjects(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId,
        targetType: BookmarkType.PROJECT,
      },
      orderBy: { createdAt: 'desc' },
      select: { targetId: true, createdAt: true },
    });

    if (bookmarks.length === 0) {
      return [];
    }

    const projectIds = bookmarks.map((b) => b.targetId);
    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
      },
      include: {
        creator: {
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
        requiredSkills: {
          include: {
            skill: true,
          },
        },
        members: {
          where: { status: MemberStatus.ACCEPTED },
          select: { id: true },
        },
        _count: {
          select: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    // Create a lookup map to preserve bookmark insertion order
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const result: Array<{
      id: string;
      title: string;
      description: string;
      domain: string;
      semester: string;
      status: any;
      requiredSkills: string[];
      ownerName: string;
      memberCount: number;
      maxMembers: number;
      createdAt: Date;
      isBookmarked: boolean;
    }> = [];

    for (const b of bookmarks) {
      const p = projectMap.get(b.targetId);
      if (p) {
        result.push({
          id: p.id,
          title: p.title,
          description: p.description,
          domain: p.domain,
          semester: p.semester,
          status: p.status,
          requiredSkills: p.requiredSkills.map((rs) => rs.skill.name),
          ownerName:
            p.creator?.profile?.fullName ||
            p.creator?.email?.split('@')[0] ||
            'Unknown',
          memberCount: p._count?.members ?? p.members?.length ?? 0,
          maxMembers: p.maxMembers,
          createdAt: p.createdAt,
          isBookmarked: true,
        });
      }
    }

    return result;
  }
}

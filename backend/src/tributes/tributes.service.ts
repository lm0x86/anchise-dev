import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TributeStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTributeDto,
  UpdateTributeDto,
  ModerateTributeDto,
  TributeQueryDto,
  ModerationQueueQueryDto,
  TributeResponseDto,
  TributeListResponseDto,
  ModerationTributeDto,
  ModerationQueueResponseDto,
} from './dto/tribute.dto';

@Injectable()
export class TributesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTributeDto, authorId: string): Promise<TributeResponseDto> {
    // Verify profile exists and is not suppressed
    const profile = await this.prisma.profile.findUnique({
      where: { id: dto.profileId },
    });

    if (!profile || profile.suppressed) {
      throw new NotFoundException('Profile not found');
    }

    const tribute = await this.prisma.tribute.create({
      data: {
        profileId: dto.profileId,
        authorId,
        content: dto.content,
        status: TributeStatus.PENDING,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    });

    return this.mapToResponse(tribute);
  }

  async findById(id: string): Promise<TributeResponseDto> {
    const tribute = await this.prisma.tribute.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    });

    if (!tribute) {
      throw new NotFoundException('Tribute not found');
    }

    return this.mapToResponse(tribute);
  }

  async findByProfile(
    profileId: string,
    query: TributeQueryDto,
  ): Promise<TributeListResponseDto> {
    const { page = 1, limit = 20 } = query;

    const where: Prisma.TributeWhereInput = {
      profileId,
      status: TributeStatus.APPROVED, // Only show approved tributes publicly
    };

    const [tributes, total] = await Promise.all([
      this.prisma.tribute.findMany({
        where,
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, displayName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tribute.count({ where }),
    ]);

    return {
      tributes: tributes.map((t) => this.mapToResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAll(query: TributeQueryDto): Promise<TributeListResponseDto> {
    const { profileId, status, page = 1, limit = 20 } = query;

    const where: Prisma.TributeWhereInput = {};

    if (profileId) {
      where.profileId = profileId;
    }

    // Default to approved for public feed
    where.status = status || TributeStatus.APPROVED;

    const [tributes, total] = await Promise.all([
      this.prisma.tribute.findMany({
        where,
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, displayName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tribute.count({ where }),
    ]);

    return {
      tributes: tributes.map((t) => this.mapToResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getModerationQueue(
    query: ModerationQueueQueryDto,
    user: User,
    userPartnerId?: string,
  ): Promise<ModerationQueueResponseDto> {
    const { partnerId, page = 1, limit = 20 } = query;

    const where: Prisma.TributeWhereInput = {
      status: TributeStatus.PENDING,
    };

    // If user is not admin, filter by their partner's profiles
    if (user.role !== 'ADMIN') {
      if (!userPartnerId) {
        throw new ForbiddenException('Partner access required');
      }
      where.profile = { partnerId: userPartnerId };
    } else if (partnerId) {
      // Admin can filter by specific partner
      where.profile = { partnerId };
    }

    const [tributes, total] = await Promise.all([
      this.prisma.tribute.findMany({
        where,
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, displayName: true },
          },
          profile: {
            select: { id: true, slug: true, firstName: true, lastName: true, partnerId: true },
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first for moderation
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tribute.count({ where }),
    ]);

    return {
      tributes: tributes.map((t) => this.mapToModerationResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: string,
    dto: UpdateTributeDto,
    userId: string,
  ): Promise<TributeResponseDto> {
    const tribute = await this.prisma.tribute.findUnique({
      where: { id },
    });

    if (!tribute) {
      throw new NotFoundException('Tribute not found');
    }

    // Only the author can edit their tribute
    if (tribute.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own tributes');
    }

    // Can only edit pending tributes
    if (tribute.status !== TributeStatus.PENDING) {
      throw new BadRequestException('Can only edit pending tributes');
    }

    const updated = await this.prisma.tribute.update({
      where: { id },
      data: {
        content: dto.content,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    });

    return this.mapToResponse(updated);
  }

  async moderate(
    id: string,
    dto: ModerateTributeDto,
    moderatorId: string,
    user: User,
    userPartnerId?: string,
  ): Promise<TributeResponseDto> {
    const tribute = await this.prisma.tribute.findUnique({
      where: { id },
      include: {
        profile: { select: { partnerId: true } },
      },
    });

    if (!tribute) {
      throw new NotFoundException('Tribute not found');
    }

    // Check authorization
    if (user.role !== 'ADMIN') {
      if (!userPartnerId || tribute.profile.partnerId !== userPartnerId) {
        throw new ForbiddenException('You can only moderate tributes on your profiles');
      }
    }

    const updated = await this.prisma.tribute.update({
      where: { id },
      data: {
        status: dto.status,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
      },
    });

    return this.mapToResponse(updated);
  }

  async delete(id: string, userId: string, user: User): Promise<void> {
    const tribute = await this.prisma.tribute.findUnique({
      where: { id },
    });

    if (!tribute) {
      throw new NotFoundException('Tribute not found');
    }

    // Only author or admin can delete
    if (tribute.authorId !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own tributes');
    }

    await this.prisma.tribute.delete({
      where: { id },
    });
  }

  private mapToResponse(tribute: {
    id: string;
    profileId: string;
    content: string;
    status: TributeStatus;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      displayName: string | null;
    };
  }): TributeResponseDto {
    return {
      id: tribute.id,
      profileId: tribute.profileId,
      content: tribute.content,
      status: tribute.status,
      author: tribute.author,
      createdAt: tribute.createdAt,
      updatedAt: tribute.updatedAt,
    };
  }

  private mapToModerationResponse(tribute: {
    id: string;
    profileId: string;
    content: string;
    status: TributeStatus;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      displayName: string | null;
    };
    profile: {
      id: string;
      slug: string;
      firstName: string;
      lastName: string;
      partnerId: string | null;
    };
  }): ModerationTributeDto {
    return {
      id: tribute.id,
      profileId: tribute.profileId,
      content: tribute.content,
      status: tribute.status,
      author: tribute.author,
      profile: tribute.profile,
      createdAt: tribute.createdAt,
      updatedAt: tribute.updatedAt,
    };
  }
}


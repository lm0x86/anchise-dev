import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateTimelineEventDto,
  UpdateTimelineEventDto,
  TimelineEventResponseDto,
  CreateProfileValueDto,
  UpdateProfileValueDto,
  ProfileValueResponseDto,
  CreateProfileQuoteDto,
  UpdateProfileQuoteDto,
  ProfileQuoteResponseDto,
  CreateAchievementDto,
  UpdateAchievementDto,
  AchievementResponseDto,
  CreateFutureMessageDto,
  UpdateFutureMessageDto,
  FutureMessageResponseDto,
  CreateProfileStatDto,
  UpdateProfileStatDto,
  ProfileStatResponseDto,
  CreateMediaItemDto,
  MediaItemResponseDto,
} from './dto/profile-content.dto';
import { MediaType } from '@prisma/client';

@Injectable()
export class ProfileContentService {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {}

  private async verifyProfileOwnership(
    profileId: string,
    partnerId: string,
  ): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, partnerId, suppressed: false },
      select: { id: true, isLocked: true },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (profile.isLocked) {
      throw new ForbiddenException('Profile is locked');
    }
  }

  // ============================================
  // PUBLIC AGGREGATED CONTENT
  // ============================================

  async getPublicContent(profileId: string) {
    const [timelineEvents, media, values, achievements, stats, tributes, quotes, futureMessages] =
      await Promise.all([
        this.prisma.timelineEvent.findMany({
          where: { profileId },
          orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }],
        }),
        this.prisma.mediaItem.findMany({
          where: { profileId, albumId: null, memoryId: null },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.profileValue.findMany({
          where: { profileId },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.achievement.findMany({
          where: { profileId },
          orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }],
        }),
        this.prisma.profileStat.findMany({
          where: { profileId },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.tribute.findMany({
          where: { profileId, status: 'APPROVED' },
          include: { author: { select: { id: true, firstName: true, lastName: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.profileQuote.findMany({
          where: { profileId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.futureMessage.findMany({
          where: { profileId },
          orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }],
        }),
      ]);

    return { timelineEvents, media, values, achievements, stats, tributes, quotes, futureMessages };
  }

  // ============================================
  // TIMELINE EVENTS
  // ============================================

  async getTimelineEvents(profileId: string): Promise<TimelineEventResponseDto[]> {
    return this.prisma.timelineEvent.findMany({
      where: { profileId },
      orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }],
    });
  }

  async createTimelineEvent(
    profileId: string,
    partnerId: string,
    dto: CreateTimelineEventDto,
  ): Promise<TimelineEventResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.timelineEvent.create({
      data: {
        profileId,
        title: dto.title,
        description: dto.description,
        date: new Date(dto.date),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        mediaUrl: dto.mediaUrl,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateTimelineEvent(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateTimelineEventDto,
  ): Promise<TimelineEventResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.timelineEvent.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Timeline event not found');

    return this.prisma.timelineEvent.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.mediaUrl !== undefined && { mediaUrl: dto.mediaUrl }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteTimelineEvent(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.timelineEvent.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Timeline event not found');
    await this.prisma.timelineEvent.delete({ where: { id: itemId } });
  }

  // ============================================
  // MEDIA ITEMS (profile-level photos)
  // ============================================

  async getProfileMedia(profileId: string): Promise<MediaItemResponseDto[]> {
    return this.prisma.mediaItem.findMany({
      where: { profileId, albumId: null, memoryId: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createProfileMedia(
    profileId: string,
    partnerId: string,
    dto: CreateMediaItemDto,
  ): Promise<MediaItemResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.mediaItem.create({
      data: {
        profileId,
        url: dto.url,
        type: dto.type ?? MediaType.IMAGE,
        caption: dto.caption,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async deleteProfileMedia(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.mediaItem.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Media item not found');
    await this.prisma.mediaItem.delete({ where: { id: itemId } });
    if (item.url) {
      try {
        const key = this.extractS3Key(item.url);
        if (key) await this.uploadsService.deleteFile(key);
      } catch {
        // S3 cleanup is best-effort
      }
    }
  }

  private extractS3Key(url: string): string | null {
    try {
      const u = new URL(url);
      return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
    } catch {
      return null;
    }
  }

  // ============================================
  // PROFILE VALUES
  // ============================================

  async getValues(profileId: string): Promise<ProfileValueResponseDto[]> {
    return this.prisma.profileValue.findMany({
      where: { profileId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createValue(
    profileId: string,
    partnerId: string,
    dto: CreateProfileValueDto,
  ): Promise<ProfileValueResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.profileValue.create({
      data: {
        profileId,
        value: dto.value,
        meaning: dto.meaning,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateValue(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateProfileValueDto,
  ): Promise<ProfileValueResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileValue.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Value not found');

    return this.prisma.profileValue.update({
      where: { id: itemId },
      data: {
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.meaning !== undefined && { meaning: dto.meaning }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteValue(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileValue.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Value not found');
    await this.prisma.profileValue.delete({ where: { id: itemId } });
  }

  // ============================================
  // PROFILE QUOTES (Life Lessons)
  // ============================================

  async getQuotes(profileId: string): Promise<ProfileQuoteResponseDto[]> {
    return this.prisma.profileQuote.findMany({
      where: { profileId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createQuote(
    profileId: string,
    partnerId: string,
    dto: CreateProfileQuoteDto,
  ): Promise<ProfileQuoteResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.profileQuote.create({
      data: {
        profileId,
        text: dto.text,
        attribution: dto.attribution,
        category: dto.category ?? 'GENERAL',
        audioUrl: dto.audioUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateQuote(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateProfileQuoteDto,
  ): Promise<ProfileQuoteResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileQuote.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Quote not found');

    return this.prisma.profileQuote.update({
      where: { id: itemId },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.attribution !== undefined && { attribution: dto.attribution }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.audioUrl !== undefined && { audioUrl: dto.audioUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteQuote(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileQuote.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Quote not found');
    await this.prisma.profileQuote.delete({ where: { id: itemId } });
  }

  // ============================================
  // ACHIEVEMENTS
  // ============================================

  async getAchievements(profileId: string): Promise<AchievementResponseDto[]> {
    return this.prisma.achievement.findMany({
      where: { profileId },
      orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }],
    });
  }

  async createAchievement(
    profileId: string,
    partnerId: string,
    dto: CreateAchievementDto,
  ): Promise<AchievementResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.achievement.create({
      data: {
        profileId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        date: dto.date ? new Date(dto.date) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        mediaUrl: dto.mediaUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateAchievement(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.achievement.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Achievement not found');

    return this.prisma.achievement.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.date !== undefined && { date: dto.date ? new Date(dto.date) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.mediaUrl !== undefined && { mediaUrl: dto.mediaUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteAchievement(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.achievement.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Achievement not found');
    await this.prisma.achievement.delete({ where: { id: itemId } });
  }

  // ============================================
  // FUTURE MESSAGES
  // ============================================

  async getFutureMessages(profileId: string): Promise<FutureMessageResponseDto[]> {
    return this.prisma.futureMessage.findMany({
      where: { profileId },
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async createFutureMessage(
    profileId: string,
    partnerId: string,
    dto: CreateFutureMessageDto,
  ): Promise<FutureMessageResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.futureMessage.create({
      data: {
        profileId,
        recipientName: dto.recipientName,
        content: dto.content,
        audioUrl: dto.audioUrl,
        videoUrl: dto.videoUrl,
        isPinned: dto.isPinned ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateFutureMessage(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateFutureMessageDto,
  ): Promise<FutureMessageResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.futureMessage.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Future message not found');

    return this.prisma.futureMessage.update({
      where: { id: itemId },
      data: {
        ...(dto.recipientName !== undefined && { recipientName: dto.recipientName }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.audioUrl !== undefined && { audioUrl: dto.audioUrl }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteFutureMessage(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.futureMessage.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Future message not found');
    await this.prisma.futureMessage.delete({ where: { id: itemId } });
  }

  // ============================================
  // PROFILE STATS
  // ============================================

  async getStats(profileId: string): Promise<ProfileStatResponseDto[]> {
    return this.prisma.profileStat.findMany({
      where: { profileId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createStat(
    profileId: string,
    partnerId: string,
    dto: CreateProfileStatDto,
  ): Promise<ProfileStatResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    return this.prisma.profileStat.create({
      data: {
        profileId,
        label: dto.label,
        value: dto.value,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateStat(
    profileId: string,
    partnerId: string,
    itemId: string,
    dto: UpdateProfileStatDto,
  ): Promise<ProfileStatResponseDto> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileStat.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Stat not found');

    return this.prisma.profileStat.update({
      where: { id: itemId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteStat(
    profileId: string,
    partnerId: string,
    itemId: string,
  ): Promise<void> {
    await this.verifyProfileOwnership(profileId, partnerId);
    const item = await this.prisma.profileStat.findFirst({
      where: { id: itemId, profileId },
    });
    if (!item) throw new NotFoundException('Stat not found');
    await this.prisma.profileStat.delete({ where: { id: itemId } });
  }
}

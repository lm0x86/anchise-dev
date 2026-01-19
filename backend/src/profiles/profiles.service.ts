import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, ProfileSource, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  ProfileQueryDto,
  ProfileResponseDto,
  ProfileListResponseDto,
  BoardProfileDto,
} from './dto/profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProfileDto, partnerId: string): Promise<ProfileResponseDto> {
    const slug = this.generateSlug(dto.firstName, dto.lastName);

    const profile = await this.prisma.profile.create({
      data: {
        slug,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        deathDate: new Date(dto.deathDate),
        sex: dto.sex,
        birthPlaceCog: dto.birthPlaceCog,
        birthPlaceLabel: dto.birthPlaceLabel,
        deathPlaceCog: dto.deathPlaceCog,
        deathPlaceLabel: dto.deathPlaceLabel,
        pinLat: dto.pinLat,
        pinLng: dto.pinLng,
        photoUrl: dto.photoUrl,
        obituary: dto.obituary,
        serviceDetails: dto.serviceDetails as Prisma.InputJsonValue,
        source: ProfileSource.PARTNER,
        partnerId,
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: true } },
      },
    });

    return this.mapToResponse(profile);
  }

  async findByIdOrSlug(idOrSlug: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        suppressed: false,
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: { where: { status: 'APPROVED' } } } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapToResponse(profile);
  }

  async findAll(query: ProfileQueryDto): Promise<ProfileListResponseDto> {
    const { from, to, cog, verifiedOnly, hasTributes, search, page = 1, limit = 50 } = query;

    const where: Prisma.ProfileWhereInput = {
      suppressed: false,
    };

    // Date filters
    if (from || to) {
      where.deathDate = {};
      if (from) where.deathDate.gte = new Date(from);
      if (to) where.deathDate.lte = new Date(to);
    }

    // Location filter
    if (cog) {
      where.deathPlaceCog = cog;
    }

    // Verified only (has partner)
    if (verifiedOnly) {
      where.partnerId = { not: null };
    }

    // Has tributes
    if (hasTributes) {
      where.tributes = { some: { status: 'APPROVED' } };
    }

    // Search by name
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        include: {
          partner: { select: { name: true } },
          _count: { select: { tributes: { where: { status: 'APPROVED' } } } },
        },
        orderBy: { deathDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      profiles: profiles.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findForBoard(query: ProfileQueryDto): Promise<BoardProfileDto[]> {
    const { 
      from, to, cog, verifiedOnly, search, limit = 100, 
      lat, lng, radius = 50,
      minLat, maxLat, minLng, maxLng 
    } = query;

    const where: Prisma.ProfileWhereInput = {
      suppressed: false,
    };

    // Date filters - default to last month if not specified
    if (from || to) {
      where.deathDate = {};
      if (from) where.deathDate.gte = new Date(from);
      if (to) where.deathDate.lte = new Date(to);
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.deathDate = { gte: thirtyDaysAgo };
    }

    // Viewport bounding box filter (takes precedence over radius)
    if (minLat !== undefined && maxLat !== undefined && minLng !== undefined && maxLng !== undefined) {
      where.pinLat = { gte: minLat, lte: maxLat };
      where.pinLng = { gte: minLng, lte: maxLng };
    }
    // Fallback to radius-based filtering if lat/lng provided but no bounds
    else if (lat !== undefined && lng !== undefined) {
      // Convert radius (km) to approximate degrees
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

      where.pinLat = { gte: lat - latDelta, lte: lat + latDelta };
      where.pinLng = { gte: lng - lngDelta, lte: lng + lngDelta };
    }

    if (cog) {
      where.deathPlaceCog = cog;
    }

    if (verifiedOnly) {
      where.partnerId = { not: null };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cap limit at 100 for performance
    const safeLimit = Math.min(limit, 100);

    let profiles = await this.prisma.profile.findMany({
      where,
      select: {
        id: true,
        slug: true,
        firstName: true,
        lastName: true,
        deathDate: true,
        deathPlaceLabel: true,
        pinLat: true,
        pinLng: true,
        partnerId: true,
        photoUrl: true,
      },
      orderBy: { deathDate: 'desc' },
      take: safeLimit * 2, // Fetch extra for distance filtering
    });

    // Filter out profiles without coordinates
    profiles = profiles.filter((p) => p.pinLat !== null && p.pinLng !== null);

    // If location provided, sort by distance and take closest
    if (lat !== undefined && lng !== undefined) {
      profiles = profiles
        .map((p) => ({
          ...p,
          distance: this.calculateDistance(lat, lng, p.pinLat!, p.pinLng!),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, safeLimit)
        .map(({ distance, ...p }) => p);
    } else {
      profiles = profiles.slice(0, safeLimit);
    }

    return profiles.map((p) => ({
      id: p.id,
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      deathDate: p.deathDate,
      deathPlaceLabel: p.deathPlaceLabel,
      pinLat: p.pinLat as number, // Safe: filtered above
      pinLng: p.pinLng as number, // Safe: filtered above
      isVerified: p.partnerId !== null,
      photoUrl: p.photoUrl,
    }));
  }

  async update(
    id: string,
    dto: UpdateProfileDto,
    user: User,
    partnerId?: string,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Check authorization: must be admin or belong to the partner
    if (user.role !== 'ADMIN') {
      if (!partnerId || profile.partnerId !== partnerId) {
        throw new ForbiddenException('You can only edit profiles belonging to your organization');
      }
    }

    const updated = await this.prisma.profile.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.deathDate && { deathDate: new Date(dto.deathDate) }),
        ...(dto.sex !== undefined && { sex: dto.sex }),
        ...(dto.birthPlaceCog !== undefined && { birthPlaceCog: dto.birthPlaceCog }),
        ...(dto.birthPlaceLabel !== undefined && { birthPlaceLabel: dto.birthPlaceLabel }),
        ...(dto.deathPlaceCog !== undefined && { deathPlaceCog: dto.deathPlaceCog }),
        ...(dto.deathPlaceLabel !== undefined && { deathPlaceLabel: dto.deathPlaceLabel }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.obituary !== undefined && { obituary: dto.obituary }),
        ...(dto.serviceDetails !== undefined && { serviceDetails: dto.serviceDetails as Prisma.InputJsonValue }),
        ...(dto.suppressed !== undefined && { suppressed: dto.suppressed }),
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: { where: { status: 'APPROVED' } } } },
      },
    });

    return this.mapToResponse(updated);
  }

  private generateSlug(firstName: string, lastName: string): string {
    const base = `${firstName}-${lastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const random = Math.random().toString(36).substring(2, 8);
    return `${base}-${random}`;
  }

  private mapToResponse(profile: {
    id: string;
    slug: string;
    firstName: string;
    lastName: string;
    birthDate: Date | null;
    deathDate: Date;
    sex: string | null;
    birthPlaceCog: string | null;
    birthPlaceLabel: string | null;
    deathPlaceCog: string | null;
    deathPlaceLabel: string | null;
    pinLat: number | null;
    pinLng: number | null;
    source: ProfileSource;
    photoUrl: string | null;
    obituary: string | null;
    serviceDetails: Prisma.JsonValue | null;
    isLocked: boolean;
    partnerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    partner?: { name: string } | null;
    _count?: { tributes: number };
  }): ProfileResponseDto {
    return {
      id: profile.id,
      slug: profile.slug,
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthDate: profile.birthDate,
      deathDate: profile.deathDate,
      sex: profile.sex as ProfileResponseDto['sex'],
      birthPlaceCog: profile.birthPlaceCog,
      birthPlaceLabel: profile.birthPlaceLabel,
      deathPlaceCog: profile.deathPlaceCog,
      deathPlaceLabel: profile.deathPlaceLabel,
      pinLat: profile.pinLat,
      pinLng: profile.pinLng,
      source: profile.source,
      photoUrl: profile.photoUrl,
      obituary: profile.obituary,
      serviceDetails: profile.serviceDetails as Record<string, unknown> | null,
      isLocked: profile.isLocked,
      partnerId: profile.partnerId,
      partnerName: profile.partner?.name ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      tributeCount: profile._count?.tributes,
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @returns Distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // ============================================
  // PARTNER-SPECIFIC METHODS
  // ============================================

  async findByPartner(
    partnerId: string,
    query: ProfileQueryDto,
  ): Promise<ProfileListResponseDto> {
    const { search, page = 1, limit = 20 } = query;

    const where: Prisma.ProfileWhereInput = {
      partnerId,
      suppressed: false,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        include: {
          partner: { select: { name: true } },
          _count: { select: { tributes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      profiles: profiles.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createForPartner(
    partnerId: string,
    dto: CreateProfileDto,
  ): Promise<ProfileResponseDto> {
    const slug = this.generateSlug(dto.firstName, dto.lastName);

    // Geocode the death place if provided but no coordinates
    let pinLat = dto.pinLat;
    let pinLng = dto.pinLng;

    if (!pinLat && !pinLng && dto.deathPlaceLabel) {
      // Try to geocode the location
      try {
        const geocodeResponse = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(dto.deathPlaceLabel)}&limit=1`,
        );
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.features && geocodeData.features.length > 0) {
          const [lng, lat] = geocodeData.features[0].geometry.coordinates;
          pinLat = lat;
          pinLng = lng;
        }
      } catch (error) {
        // Geocoding failed, continue without coordinates
        console.warn('Geocoding failed:', error);
      }
    }

    const profile = await this.prisma.profile.create({
      data: {
        slug,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        deathDate: new Date(dto.deathDate),
        sex: dto.sex,
        birthPlaceCog: dto.birthPlaceCog,
        birthPlaceLabel: dto.birthPlaceLabel,
        deathPlaceCog: dto.deathPlaceCog,
        deathPlaceLabel: dto.deathPlaceLabel,
        pinLat,
        pinLng,
        photoUrl: dto.photoUrl,
        obituary: dto.obituary,
        serviceDetails: dto.serviceDetails as Prisma.InputJsonValue,
        source: ProfileSource.PARTNER,
        partnerId,
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: true } },
      },
    });

    return this.mapToResponse(profile);
  }

  async findByIdForPartner(
    id: string,
    partnerId: string,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id,
        partnerId,
        suppressed: false,
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapToResponse(profile);
  }

  async updateForPartner(
    id: string,
    partnerId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id,
        partnerId,
        suppressed: false,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.isLocked) {
      throw new ForbiddenException('This profile is locked and cannot be edited');
    }

    const updated = await this.prisma.profile.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.deathDate !== undefined && { deathDate: new Date(dto.deathDate) }),
        ...(dto.sex !== undefined && { sex: dto.sex }),
        ...(dto.birthPlaceCog !== undefined && { birthPlaceCog: dto.birthPlaceCog }),
        ...(dto.birthPlaceLabel !== undefined && { birthPlaceLabel: dto.birthPlaceLabel }),
        ...(dto.deathPlaceCog !== undefined && { deathPlaceCog: dto.deathPlaceCog }),
        ...(dto.deathPlaceLabel !== undefined && { deathPlaceLabel: dto.deathPlaceLabel }),
        ...(dto.pinLat !== undefined && { pinLat: dto.pinLat }),
        ...(dto.pinLng !== undefined && { pinLng: dto.pinLng }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.obituary !== undefined && { obituary: dto.obituary }),
        ...(dto.serviceDetails !== undefined && { serviceDetails: dto.serviceDetails as Prisma.InputJsonValue }),
      },
      include: {
        partner: { select: { name: true } },
        _count: { select: { tributes: true } },
      },
    });

    return this.mapToResponse(updated);
  }

  async deleteForPartner(id: string, partnerId: string): Promise<void> {
    const profile = await this.prisma.profile.findFirst({
      where: {
        id,
        partnerId,
        suppressed: false,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.isLocked) {
      throw new ForbiddenException('This profile is locked and cannot be deleted');
    }

    // Soft delete by suppressing
    await this.prisma.profile.update({
      where: { id },
      data: { suppressed: true },
    });
  }
}


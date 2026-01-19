import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PartnerType, PartnerStatus, User, UserRole, PartnerRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  InviteUserDto,
  PartnerQueryDto,
  PartnerResponseDto,
  PartnerListResponseDto,
  PartnerDashboardDto,
  PartnerUserDto,
  RequestPartnerDto,
  ReviewPartnerDto,
} from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  // Admin creates an approved partner directly
  async create(dto: CreatePartnerDto): Promise<PartnerResponseDto> {
    const slug = this.generateSlug(dto.name);

    const partner = await this.prisma.partner.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        contactEmail: dto.contactEmail,
        logoUrl: dto.logoUrl,
        status: PartnerStatus.APPROVED, // Admin-created partners are approved
      },
      include: {
        _count: { select: { profiles: true } },
      },
    });

    return this.mapToResponse(partner);
  }

  // User requests to become a partner (requires approval)
  async requestPartner(dto: RequestPartnerDto, user: User): Promise<PartnerResponseDto> {
    // Check if user already has a pending or approved partner request
    const existingPartner = await this.prisma.partnerUser.findFirst({
      where: { userId: user.id },
      include: { partner: true },
    });

    if (existingPartner) {
      if (existingPartner.partner.status === PartnerStatus.PENDING) {
        throw new ConflictException('You already have a pending partner request');
      }
      if (existingPartner.partner.status === PartnerStatus.APPROVED) {
        throw new ConflictException('You are already associated with a partner organization');
      }
    }

    const slug = this.generateSlug(dto.name);

    const partner = await this.prisma.partner.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        contactEmail: user.email,
        status: PartnerStatus.PENDING, // Requires admin approval
        users: {
          create: {
            userId: user.id,
            role: PartnerRole.OWNER,
          },
        },
      },
      include: {
        _count: { select: { profiles: true } },
      },
    });

    return this.mapToResponse(partner);
  }

  // Admin reviews (approves/rejects) a partner request
  async reviewPartner(id: string, dto: ReviewPartnerDto): Promise<PartnerResponseDto> {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        users: {
          include: { user: true },
          where: { role: PartnerRole.OWNER },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    if (partner.status !== PartnerStatus.PENDING) {
      throw new BadRequestException('Can only review pending partner requests');
    }

    if (dto.status === 'REJECTED' && !dto.rejectedReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.partner.update({
      where: { id },
      data: {
        status: dto.status as PartnerStatus,
        rejectedReason: dto.status === 'REJECTED' ? dto.rejectedReason : null,
      },
      include: {
        _count: { select: { profiles: true } },
      },
    });

    // If approved, update the owner's role to PARTNER
    if (dto.status === 'APPROVED' && partner.users.length > 0) {
      const owner = partner.users[0];
      if (owner.user.role === UserRole.USER) {
        await this.prisma.user.update({
          where: { id: owner.userId },
          data: { role: UserRole.PARTNER },
        });
      }
    }

    return this.mapToResponse(updated);
  }

  // Get pending partner requests (admin only)
  async getPendingRequests(page: number = 1, limit: number = 20): Promise<PartnerListResponseDto> {
    const where: Prisma.PartnerWhereInput = {
      status: PartnerStatus.PENDING,
    };

    const [partners, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        include: {
          _count: { select: { profiles: true } },
          users: {
            include: {
              user: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
            where: { role: PartnerRole.OWNER },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      partners: partners.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<PartnerResponseDto> {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        _count: { select: { profiles: true } },
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return this.mapToResponse(partner);
  }

  async findAll(query: PartnerQueryDto, isAdmin: boolean = false): Promise<PartnerListResponseDto> {
    const { type, search, verifiedOnly, status, page = 1, limit = 20 } = query;

    const where: Prisma.PartnerWhereInput = {};

    // For non-admins, only show approved partners
    if (!isAdmin) {
      where.status = PartnerStatus.APPROVED;
    } else if (status) {
      // Admin can filter by specific status
      where.status = status;
    }

    if (verifiedOnly) {
      where.verified = true;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [partners, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        include: {
          _count: { select: { profiles: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      partners: partners.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: string,
    dto: UpdatePartnerDto,
    user: User,
    userPartnerId?: string,
  ): Promise<PartnerResponseDto> {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Check authorization
    if (user.role !== UserRole.ADMIN) {
      if (!userPartnerId || userPartnerId !== id) {
        throw new ForbiddenException('You can only update your own organization');
      }
      // Non-admin cannot change verified or status
      delete dto.verified;
      delete dto.status;
    }

    const updated = await this.prisma.partner.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.verified !== undefined && user.role === UserRole.ADMIN && { verified: dto.verified }),
        ...(dto.status !== undefined && user.role === UserRole.ADMIN && { status: dto.status }),
      },
      include: {
        _count: { select: { profiles: true } },
      },
    });

    // If status changed to APPROVED, update the owner's role to PARTNER
    if (dto.status === PartnerStatus.APPROVED && partner.status !== PartnerStatus.APPROVED) {
      const ownerUser = await this.prisma.partnerUser.findFirst({
        where: { partnerId: id, role: PartnerRole.OWNER },
        include: { user: true },
      });
      if (ownerUser && ownerUser.user.role === UserRole.USER) {
        await this.prisma.user.update({
          where: { id: ownerUser.userId },
          data: { role: UserRole.PARTNER },
        });
      }
    }

    return this.mapToResponse(updated);
  }

  async getDashboard(
    partnerId: string,
    user: User,
    userPartnerId?: string,
  ): Promise<PartnerDashboardDto> {
    // Check authorization
    if (user.role !== UserRole.ADMIN) {
      if (!userPartnerId || userPartnerId !== partnerId) {
        throw new ForbiddenException('You can only view your own organization dashboard');
      }
    }

    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        _count: { select: { profiles: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Get tribute stats
    const [pendingTributes, approvedTributes] = await Promise.all([
      this.prisma.tribute.count({
        where: {
          profile: { partnerId },
          status: 'PENDING',
        },
      }),
      this.prisma.tribute.count({
        where: {
          profile: { partnerId },
          status: 'APPROVED',
        },
      }),
    ]);

    // Get recent views (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentViews = await this.prisma.profileViewLog.count({
      where: {
        profile: { partnerId },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return {
      partner: this.mapToResponse(partner),
      stats: {
        totalProfiles: partner._count.profiles,
        pendingTributes,
        approvedTributes,
        recentViews,
      },
      users: partner.users.map((pu) => ({
        id: pu.user.id,
        email: pu.user.email,
        firstName: pu.user.firstName,
        lastName: pu.user.lastName,
        partnerRole: pu.role,
        joinedAt: pu.createdAt,
      })),
    };
  }

  async inviteUser(
    partnerId: string,
    dto: InviteUserDto,
    user: User,
    userPartnerId?: string,
  ): Promise<PartnerUserDto> {
    // Check authorization
    if (user.role !== UserRole.ADMIN) {
      if (!userPartnerId || userPartnerId !== partnerId) {
        throw new ForbiddenException('You can only invite users to your own organization');
      }
    }

    // Check partner exists
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Check if email already exists
    let existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Check if user is already a member of this partner
      const existingMembership = await this.prisma.partnerUser.findUnique({
        where: {
          userId_partnerId: {
            userId: existingUser.id,
            partnerId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('User is already a member of this organization');
      }

      // Add existing user to partner
      const partnerUser = await this.prisma.partnerUser.create({
        data: {
          userId: existingUser.id,
          partnerId,
          role: dto.role || PartnerRole.MEMBER,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Update user role to PARTNER if they're just a USER
      if (existingUser.role === UserRole.USER) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { role: UserRole.PARTNER },
        });
      }

      return {
        id: partnerUser.user.id,
        email: partnerUser.user.email,
        firstName: partnerUser.user.firstName,
        lastName: partnerUser.user.lastName,
        partnerRole: partnerUser.role,
        joinedAt: partnerUser.createdAt,
      };
    }

    // User doesn't exist - reject the request
    throw new NotFoundException('User not found. The user must register on the platform first before being assigned to a partner.');
  }

  /**
   * Assign an existing user to a partner by user ID
   */
  async assignUser(
    partnerId: string,
    userId: string,
    role: PartnerRole = PartnerRole.MEMBER,
  ): Promise<PartnerUserDto> {
    // Check partner exists
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Check user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member of this partner
    const existingMembership = await this.prisma.partnerUser.findUnique({
      where: {
        userId_partnerId: {
          userId,
          partnerId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Add user to partner
    const partnerUser = await this.prisma.partnerUser.create({
      data: {
        userId,
        partnerId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update user role to PARTNER if they're just a USER
    if (existingUser.role === UserRole.USER) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.PARTNER },
      });
    }

    return {
      id: partnerUser.user.id,
      email: partnerUser.user.email,
      firstName: partnerUser.user.firstName,
      lastName: partnerUser.user.lastName,
      partnerRole: partnerUser.role,
      joinedAt: partnerUser.createdAt,
    };
  }

  async getPartnerIdForUser(userId: string): Promise<string | undefined> {
    const partnerUser = await this.prisma.partnerUser.findFirst({
      where: { userId },
      select: { partnerId: true },
    });

    return partnerUser?.partnerId ?? undefined;
  }

  async getTributesForPartner(
    partnerId: string,
    status?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: Prisma.TributeWhereInput = {
      profile: { partnerId },
    };

    if (status && status !== 'ALL') {
      where.status = status as 'PENDING' | 'APPROVED' | 'HIDDEN' | 'REMOVED';
    }

    const [tributes, total] = await Promise.all([
      this.prisma.tribute.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          profile: {
            select: {
              id: true,
              slug: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tribute.count({ where }),
    ]);

    return {
      tributes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const random = Math.random().toString(36).substring(2, 6);
    return `${base}-${random}`;
  }

  private mapToResponse(partner: {
    id: string;
    name: string;
    slug: string;
    type: PartnerType;
    contactEmail: string;
    logoUrl: string | null;
    verified: boolean;
    status: PartnerStatus;
    rejectedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { profiles: number };
  }): PartnerResponseDto {
    return {
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      type: partner.type,
      contactEmail: partner.contactEmail,
      logoUrl: partner.logoUrl,
      verified: partner.verified,
      status: partner.status,
      rejectedReason: partner.rejectedReason,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      profileCount: partner._count?.profiles,
    };
  }
}

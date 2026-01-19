import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
  IsUrl,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartnerType, PartnerRole, PartnerStatus } from '@prisma/client';

// ============================================
// CREATE / UPDATE DTOs
// ============================================

export class CreatePartnerDto {
  @ApiProperty({ example: 'Pompes Funèbres Générales' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: PartnerType })
  @IsEnum(PartnerType)
  type: PartnerType;

  @ApiProperty({ example: 'contact@pfg.fr' })
  @IsEmail()
  contactEmail: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}

// DTO for users requesting to become a partner
export class RequestPartnerDto {
  @ApiProperty({ example: 'Pompes Funèbres Générales', description: 'Organization name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: PartnerType, description: 'Type of organization' })
  @IsEnum(PartnerType)
  type: PartnerType;

  @ApiPropertyOptional({ example: 'We are a family-owned funeral home serving the community for 50 years.', description: 'Brief description of your organization' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

// DTO for admin to approve/reject partner requests
export class ReviewPartnerDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Reason for rejection (required if rejecting)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectedReason?: string;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: PartnerType })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Admin only: set verification status' })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ enum: PartnerStatus, description: 'Admin only: set approval status' })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;
}

// ============================================
// INVITE USER DTO
// ============================================

export class InviteUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ enum: PartnerRole, default: PartnerRole.MEMBER })
  @IsOptional()
  @IsEnum(PartnerRole)
  role?: PartnerRole;
}

// ============================================
// QUERY DTOs
// ============================================

export class PartnerQueryDto {
  @ApiPropertyOptional({ enum: PartnerType })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Include only verified partners', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ enum: PartnerStatus, description: 'Filter by status (admin only)' })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class PartnerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: PartnerType })
  type: PartnerType;

  @ApiProperty()
  contactEmail: string;

  @ApiPropertyOptional()
  logoUrl: string | null;

  @ApiProperty()
  verified: boolean;

  @ApiProperty({ enum: PartnerStatus })
  status: PartnerStatus;

  @ApiPropertyOptional({ description: 'Reason for rejection if status is REJECTED' })
  rejectedReason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Number of profiles managed by this partner' })
  profileCount?: number;
}

export class PartnerListResponseDto {
  @ApiProperty({ type: [PartnerResponseDto] })
  partners: PartnerResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PartnerUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: PartnerRole })
  partnerRole: PartnerRole;

  @ApiProperty()
  joinedAt: Date;
}

export class PartnerDashboardDto {
  @ApiProperty()
  partner: PartnerResponseDto;

  @ApiProperty()
  stats: {
    totalProfiles: number;
    pendingTributes: number;
    approvedTributes: number;
    recentViews: number;
  };

  @ApiProperty({ type: [PartnerUserDto] })
  users: PartnerUserDto[];
}

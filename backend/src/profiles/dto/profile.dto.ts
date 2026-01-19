import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Sex, ProfileSource } from '@prisma/client';

// ============================================
// CREATE / UPDATE DTOs
// ============================================

export class CreateProfileDto {
  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ example: '1935-03-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ example: '2025-01-10' })
  @IsDateString()
  deathDate: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ example: '75056' })
  @IsOptional()
  @IsString()
  birthPlaceCog?: string;

  @ApiPropertyOptional({ example: 'Paris' })
  @IsOptional()
  @IsString()
  birthPlaceLabel?: string;

  @ApiPropertyOptional({ example: '75056', description: 'COG code for death location' })
  @IsOptional()
  @IsString()
  deathPlaceCog?: string;

  @ApiPropertyOptional({ example: 'Paris' })
  @IsOptional()
  @IsString()
  deathPlaceLabel?: string;

  @ApiPropertyOptional({ example: 48.8566, description: 'Latitude for map pin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pinLat?: number;

  @ApiPropertyOptional({ example: 2.3522, description: 'Longitude for map pin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pinLng?: number;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'A beloved father and grandfather...' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  obituary?: string;

  @ApiPropertyOptional({ description: 'Service details JSON' })
  @IsOptional()
  @IsObject()
  serviceDetails?: Record<string, unknown>;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deathDate?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthPlaceCog?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthPlaceLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deathPlaceCog?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deathPlaceLabel?: string;

  @ApiPropertyOptional({ description: 'Latitude for map pin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  pinLat?: number;

  @ApiPropertyOptional({ description: 'Longitude for map pin' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  pinLng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  obituary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  serviceDetails?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  suppressed?: boolean;
}

// ============================================
// QUERY DTOs
// ============================================

export class ProfileQueryDto {
  @ApiPropertyOptional({ description: 'Filter by death date from (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter by death date to (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by COG code' })
  @IsOptional()
  @IsString()
  cog?: string;

  @ApiPropertyOptional({ description: 'Filter verified profiles only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter profiles with tributes' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  @IsBoolean()
  hasTributes?: boolean;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'User latitude for proximity search' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'User longitude for proximity search' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in kilometers', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius?: number = 50;

  // Bounding box for viewport filtering
  @ApiPropertyOptional({ description: 'Minimum latitude (south boundary)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLat?: number;

  @ApiPropertyOptional({ description: 'Maximum latitude (north boundary)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLat?: number;

  @ApiPropertyOptional({ description: 'Minimum longitude (west boundary)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minLng?: number;

  @ApiPropertyOptional({ description: 'Maximum longitude (east boundary)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxLng?: number;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class ProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  birthDate: Date | null;

  @ApiProperty()
  deathDate: Date;

  @ApiPropertyOptional({ enum: Sex })
  sex: Sex | null;

  @ApiPropertyOptional()
  birthPlaceCog: string | null;

  @ApiPropertyOptional()
  birthPlaceLabel: string | null;

  @ApiPropertyOptional()
  deathPlaceCog: string | null;

  @ApiPropertyOptional()
  deathPlaceLabel: string | null;

  @ApiPropertyOptional()
  pinLat: number | null;

  @ApiPropertyOptional()
  pinLng: number | null;

  @ApiProperty({ enum: ProfileSource })
  source: ProfileSource;

  @ApiPropertyOptional()
  photoUrl: string | null;

  @ApiPropertyOptional()
  obituary: string | null;

  @ApiPropertyOptional()
  serviceDetails: Record<string, unknown> | null;

  @ApiProperty()
  isLocked: boolean;

  @ApiPropertyOptional()
  partnerId: string | null;

  @ApiPropertyOptional()
  partnerName?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  tributeCount?: number;
}

export class ProfileListResponseDto {
  @ApiProperty({ type: [ProfileResponseDto] })
  profiles: ProfileResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// Board-specific lightweight response
export class BoardProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  deathDate: Date;

  @ApiPropertyOptional()
  deathPlaceLabel: string | null;

  @ApiProperty({ description: 'Latitude for map pin' })
  pinLat: number;

  @ApiProperty({ description: 'Longitude for map pin' })
  pinLng: number;

  @ApiProperty()
  isVerified: boolean;

  @ApiPropertyOptional()
  photoUrl: string | null;
}


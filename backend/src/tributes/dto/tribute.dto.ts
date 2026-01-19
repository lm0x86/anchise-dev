import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TributeStatus } from '@prisma/client';

// ============================================
// CREATE / UPDATE DTOs
// ============================================

export class CreateTributeDto {
  @ApiProperty({ example: 'cmkb40n2c0000x9uwzr7wd7ic' })
  @IsString()
  profileId: string;

  @ApiProperty({ example: 'Rest in peace, dear friend. You will be missed.', maxLength: 2000 })
  @IsString()
  @MinLength(1, { message: 'Content is required' })
  @MaxLength(2000, { message: 'Content must be at most 2000 characters' })
  content: string;
}

export class UpdateTributeDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;
}

export class ModerateTributeDto {
  @ApiProperty({ enum: TributeStatus })
  @IsEnum(TributeStatus)
  status: TributeStatus;
}

// ============================================
// QUERY DTOs
// ============================================

export class TributeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by profile ID' })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({ enum: TributeStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(TributeStatus)
  status?: TributeStatus;

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

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ description: 'Filter by partner ID' })
  @IsOptional()
  @IsString()
  partnerId?: string;

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

export class TributeAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  displayName: string | null;
}

export class TributeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: TributeStatus })
  status: TributeStatus;

  @ApiProperty()
  author: TributeAuthorDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TributeListResponseDto {
  @ApiProperty({ type: [TributeResponseDto] })
  tributes: TributeResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// For moderation queue - includes profile info
export class ModerationTributeDto extends TributeResponseDto {
  @ApiProperty()
  profile: {
    id: string;
    slug: string;
    firstName: string;
    lastName: string;
    partnerId: string | null;
  };
}

export class ModerationQueueResponseDto {
  @ApiProperty({ type: [ModerationTributeDto] })
  tributes: ModerationTributeDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}


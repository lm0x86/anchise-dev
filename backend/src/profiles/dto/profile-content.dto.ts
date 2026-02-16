import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  MediaType,
  AlbumType,
  MemoryType,
  FavoriteCategory,
  AchievementCategory,
  CauseType,
  CreationType,
  PrayerSymbol,
  Visibility,
  ContentStatus,
} from '@prisma/client';

// ============================================
// TIMELINE EVENT DTOs
// ============================================

export class CreateTimelineEventDto {
  @ApiProperty({ example: 'Graduated from University' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Completed degree in Computer Science with honors' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '1990-06-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'https://example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTimelineEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class TimelineEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  date: Date;

  @ApiPropertyOptional()
  mediaUrl: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// MEMORY DTOs
// ============================================

export class CreateMemoryDto {
  @ApiPropertyOptional({ example: 'A wonderful memory of our time together' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ enum: MemoryType, default: MemoryType.TEXT })
  @IsOptional()
  @IsEnum(MemoryType)
  type?: MemoryType;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PUBLIC })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

export class MemoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  authorId: string;

  @ApiPropertyOptional()
  content: string | null;

  @ApiProperty({ enum: MemoryType })
  type: MemoryType;

  @ApiProperty({ enum: Visibility })
  visibility: Visibility;

  @ApiProperty({ enum: ContentStatus })
  status: ContentStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };

  @ApiPropertyOptional({ type: () => [MediaItemResponseDto] })
  mediaItems?: MediaItemResponseDto[];
}

// ============================================
// ALBUM DTOs
// ============================================

export class CreateAlbumDto {
  @ApiProperty({ example: 'Family Vacation 2020' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Photos from our trip to the mountains' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ enum: AlbumType, default: AlbumType.PHOTOS })
  @IsOptional()
  @IsEnum(AlbumType)
  type?: AlbumType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAlbumDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({ enum: AlbumType })
  @IsOptional()
  @IsEnum(AlbumType)
  type?: AlbumType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class AlbumResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  coverUrl: string | null;

  @ApiProperty({ enum: AlbumType })
  type: AlbumType;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  mediaCount?: number;

  @ApiPropertyOptional({ type: () => [MediaItemResponseDto] })
  mediaItems?: MediaItemResponseDto[];
}

// ============================================
// MEDIA ITEM DTOs
// ============================================

export class CreateMediaItemDto {
  @ApiProperty({ example: 'https://example.com/photo.jpg' })
  @IsString()
  url: string;

  @ApiProperty({ enum: MediaType })
  @IsEnum(MediaType)
  type: MediaType;

  @ApiPropertyOptional({ example: 'Beautiful sunset at the beach' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class MediaItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  albumId: string | null;

  @ApiPropertyOptional()
  memoryId: string | null;

  @ApiProperty()
  url: string;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiPropertyOptional()
  caption: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;
}

// ============================================
// PROFILE VALUE DTOs
// ============================================

export class CreateProfileValueDto {
  @ApiProperty({ example: 'Integrity' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value: string;

  @ApiPropertyOptional({ example: 'Always being honest and true to my word' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meaning?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProfileValueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meaning?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class ProfileValueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  value: string;

  @ApiPropertyOptional()
  meaning: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// PROFILE FAVORITE DTOs
// ============================================

export class CreateProfileFavoriteDto {
  @ApiProperty({ enum: FavoriteCategory })
  @IsEnum(FavoriteCategory)
  category: FavoriteCategory;

  @ApiProperty({ example: 'The Great Gatsby' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'A timeless classic that shaped my view on life' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProfileFavoriteDto {
  @ApiPropertyOptional({ enum: FavoriteCategory })
  @IsOptional()
  @IsEnum(FavoriteCategory)
  category?: FavoriteCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class ProfileFavoriteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty({ enum: FavoriteCategory })
  category: FavoriteCategory;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  note: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// PROFILE QUOTE DTOs
// ============================================

export class CreateProfileQuoteDto {
  @ApiProperty({ example: 'The only way to do great work is to love what you do.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;

  @ApiPropertyOptional({ example: 'Steve Jobs' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attribution?: string;

  @ApiPropertyOptional({ example: 'https://example.com/audio.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProfileQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attribution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class ProfileQuoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional()
  attribution: string | null;

  @ApiPropertyOptional()
  audioUrl: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// FUN FACT DTOs
// ============================================

export class CreateFunFactDto {
  @ApiProperty({ example: 'Once climbed Mount Everest in flip-flops' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fact: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateFunFactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  fact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class FunFactResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  fact: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// BUCKET LIST ITEM DTOs
// ============================================

export class CreateBucketListItemDto {
  @ApiProperty({ example: 'Visit all 7 continents' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  item: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({ example: '2023-05-20' })
  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateBucketListItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  item?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class BucketListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  item: string;

  @ApiProperty()
  isCompleted: boolean;

  @ApiPropertyOptional()
  completedDate: Date | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// ACHIEVEMENT DTOs
// ============================================

export class CreateAchievementDto {
  @ApiProperty({ example: 'Employee of the Year' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Recognized for outstanding contributions to the team' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  category: AchievementCategory;

  @ApiPropertyOptional({ example: '2022-12-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'https://example.com/award.jpg' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAchievementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: AchievementCategory })
  @IsOptional()
  @IsEnum(AchievementCategory)
  category?: AchievementCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class AchievementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: AchievementCategory })
  category: AchievementCategory;

  @ApiPropertyOptional()
  date: Date | null;

  @ApiPropertyOptional()
  mediaUrl: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// CAUSE DTOs
// ============================================

export class CreateCauseDto {
  @ApiProperty({ example: 'Red Cross' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Supporting disaster relief efforts worldwide' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: CauseType })
  @IsEnum(CauseType)
  type: CauseType;

  @ApiPropertyOptional({ example: 'https://redcross.org' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCauseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: CauseType })
  @IsOptional()
  @IsEnum(CauseType)
  type?: CauseType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class CauseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: CauseType })
  type: CauseType;

  @ApiPropertyOptional()
  externalUrl: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// CREATION DTOs
// ============================================

export class CreateCreationDto {
  @ApiProperty({ example: 'Symphony No. 5' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'A musical composition inspired by nature' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: CreationType })
  @IsEnum(CreationType)
  type: CreationType;

  @ApiPropertyOptional({ example: 'https://example.com/artwork.jpg' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 'https://spotify.com/track/123' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCreationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: CreationType })
  @IsOptional()
  @IsEnum(CreationType)
  type?: CreationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class CreationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: CreationType })
  type: CreationType;

  @ApiPropertyOptional()
  mediaUrl: string | null;

  @ApiPropertyOptional()
  externalUrl: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// FUTURE MESSAGE DTOs
// ============================================

export class CreateFutureMessageDto {
  @ApiPropertyOptional({ example: 'Dear family, I want you to know how much I love you...' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/audio.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/video.mp4' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class UpdateFutureMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class FutureMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiPropertyOptional()
  content: string | null;

  @ApiPropertyOptional()
  audioUrl: string | null;

  @ApiPropertyOptional()
  videoUrl: string | null;

  @ApiProperty()
  isPinned: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================
// PRAYER DTOs
// ============================================

export class CreatePrayerDto {
  @ApiPropertyOptional({ example: 'Wishing peace and comfort to the family' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/prayer-audio.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ enum: PrayerSymbol })
  @IsOptional()
  @IsEnum(PrayerSymbol)
  symbol?: PrayerSymbol;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PUBLIC })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

export class PrayerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profileId: string;

  @ApiProperty()
  authorId: string;

  @ApiPropertyOptional()
  content: string | null;

  @ApiPropertyOptional()
  audioUrl: string | null;

  @ApiPropertyOptional({ enum: PrayerSymbol })
  symbol: PrayerSymbol | null;

  @ApiProperty({ enum: Visibility })
  visibility: Visibility;

  @ApiProperty({ enum: ContentStatus })
  status: ContentStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
}

// ============================================
// QUERY DTOs
// ============================================

export class ContentQueryDto {
  @ApiPropertyOptional({ enum: Visibility })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class FavoriteQueryDto extends ContentQueryDto {
  @ApiPropertyOptional({ enum: FavoriteCategory })
  @IsOptional()
  @IsEnum(FavoriteCategory)
  category?: FavoriteCategory;
}

export class AchievementQueryDto extends ContentQueryDto {
  @ApiPropertyOptional({ enum: AchievementCategory })
  @IsOptional()
  @IsEnum(AchievementCategory)
  category?: AchievementCategory;
}

// ============================================
// BATCH RESPONSE DTOs
// ============================================

export class ProfileContentResponseDto {
  @ApiPropertyOptional({ type: [TimelineEventResponseDto] })
  timeline?: TimelineEventResponseDto[];

  @ApiPropertyOptional({ type: [MemoryResponseDto] })
  memories?: MemoryResponseDto[];

  @ApiPropertyOptional({ type: [AlbumResponseDto] })
  albums?: AlbumResponseDto[];

  @ApiPropertyOptional({ type: [ProfileValueResponseDto] })
  values?: ProfileValueResponseDto[];

  @ApiPropertyOptional({ type: [ProfileFavoriteResponseDto] })
  favorites?: ProfileFavoriteResponseDto[];

  @ApiPropertyOptional({ type: [ProfileQuoteResponseDto] })
  quotes?: ProfileQuoteResponseDto[];

  @ApiPropertyOptional({ type: [FunFactResponseDto] })
  funFacts?: FunFactResponseDto[];

  @ApiPropertyOptional({ type: [BucketListItemResponseDto] })
  bucketList?: BucketListItemResponseDto[];

  @ApiPropertyOptional({ type: [AchievementResponseDto] })
  achievements?: AchievementResponseDto[];

  @ApiPropertyOptional({ type: [CauseResponseDto] })
  causes?: CauseResponseDto[];

  @ApiPropertyOptional({ type: [CreationResponseDto] })
  creations?: CreationResponseDto[];

  @ApiPropertyOptional({ type: FutureMessageResponseDto })
  futureMessage?: FutureMessageResponseDto | null;

  @ApiPropertyOptional({ type: [PrayerResponseDto] })
  prayers?: PrayerResponseDto[];
}

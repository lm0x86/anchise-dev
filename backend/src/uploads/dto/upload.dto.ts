import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class PresignedUrlRequestDto {
  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  filename: string;

  @ApiProperty({ example: 'image/jpeg', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  contentType: string;

  @ApiPropertyOptional({ example: 'profiles', description: 'Upload folder' })
  @IsOptional()
  @IsString()
  folder?: string;
}

export class UploadResponseDto {
  @ApiProperty({ example: 'profiles/abc123/photo.jpg' })
  key: string;

  @ApiProperty({ example: 'https://bucket.s3.region.amazonaws.com/profiles/abc123/photo.jpg' })
  url: string;

  @ApiProperty({ example: 'my-bucket' })
  bucket: string;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ description: 'Pre-signed URL for uploading' })
  uploadUrl: string;

  @ApiProperty({ example: 'profiles/abc123.jpg' })
  key: string;

  @ApiProperty({ example: 'https://bucket.s3.region.amazonaws.com/profiles/abc123.jpg' })
  publicUrl: string;

  @ApiProperty({ example: 3600, description: 'URL expiration in seconds' })
  expiresIn: number;
}


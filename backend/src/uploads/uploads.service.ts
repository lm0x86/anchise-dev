import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AwsConfigType, AWS_CONFIG_KEY } from '../config/aws.config';
import { randomUUID } from 'crypto';
import * as path from 'path';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  // Allowed file types
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get<AwsConfigType>(AWS_CONFIG_KEY);

    if (!awsConfig?.accessKeyId || !awsConfig?.secretAccessKey) {
      console.warn('AWS credentials not configured - uploads will fail');
    }

    if (!awsConfig?.s3Bucket) {
      console.warn('AWS S3 bucket not configured - uploads will fail');
    }

    this.bucket = awsConfig?.s3Bucket || '';
    this.region = awsConfig?.s3Region || 'us-east-2'; // Ohio

    console.log(`S3 configured: bucket=${this.bucket}, region=${this.region}`);

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: awsConfig?.accessKeyId || '',
        secretAccessKey: awsConfig?.secretAccessKey || '',
      },
      ...(awsConfig?.s3Endpoint && { endpoint: awsConfig.s3Endpoint }),
    });
  }

  /**
   * Upload a file directly to S3
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<UploadResult> {
    this.validateFile(file);

    const ext = path.extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        }),
      );

      return {
        key,
        url: this.getPublicUrl(key),
        bucket: this.bucket,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Upload a profile photo
   */
  async uploadProfilePhoto(
    file: Express.Multer.File,
    profileId: string,
  ): Promise<UploadResult> {
    this.validateFile(file);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const key = `profiles/${profileId}/photo${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000',
        }),
      );

      return {
        key,
        url: this.getPublicUrl(key),
        bucket: this.bucket,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new InternalServerErrorException('Failed to upload profile photo');
    }
  }

  /**
   * Upload a partner logo
   */
  async uploadPartnerLogo(
    file: Express.Multer.File,
    partnerId: string,
  ): Promise<UploadResult> {
    this.validateFile(file);

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const key = `partners/${partnerId}/logo${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000',
        }),
      );

      return {
        key,
        url: this.getPublicUrl(key),
        bucket: this.bucket,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new InternalServerErrorException('Failed to upload partner logo');
    }
  }

  /**
   * Generate a presigned URL for client-side uploads
   */
  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    folder: string = 'uploads',
  ): Promise<PresignedUrlResult> {
    if (!this.ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    const ext = path.extname(filename).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;
    const expiresIn = 3600; // 1 hour

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: 'max-age=31536000',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return {
        uploadUrl,
        key,
        publicUrl: this.getPublicUrl(key),
        expiresIn,
      };
    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      console.error('S3 delete error:', error);
      // Don't throw - deletion failures shouldn't break the flow
    }
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Signed URL error:', error);
      throw new InternalServerErrorException('Failed to generate download URL');
    }
  }

  /**
   * Get the public URL for a file
   * Assumes bucket is configured for public read access
   */
  private getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }
}


import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UploadsService, UploadResult, PresignedUrlResult } from './uploads.service';
import {
  PresignedUrlRequestDto,
  UploadResponseDto,
  PresignedUrlResponseDto,
} from './dto/upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // ============================================
  // PRESIGNED URL (Client-side upload)
  // ============================================

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a presigned URL for client-side upload' })
  @ApiResponse({ status: 200, type: PresignedUrlResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPresignedUrl(
    @Body() dto: PresignedUrlRequestDto,
  ): Promise<PresignedUrlResult> {
    return this.uploadsService.getPresignedUploadUrl(
      dto.filename,
      dto.contentType,
      dto.folder,
    );
  }

  // ============================================
  // DIRECT UPLOAD (Server-side)
  // ============================================

  @Post('profile/:profileId/photo')
  @UseGuards(RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a profile photo (Partner/Admin only)' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async uploadProfilePhoto(
    @Param('profileId') profileId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadsService.uploadProfilePhoto(file, profileId);
  }

  @Post('partner/:partnerId/logo')
  @UseGuards(RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a partner logo (Partner/Admin only)' })
  @ApiParam({ name: 'partnerId', description: 'Partner ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async uploadPartnerLogo(
    @Param('partnerId') partnerId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadsService.uploadPartnerLogo(file, partnerId);
  }

  @Post('general')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a general file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadsService.uploadFile(file);
  }

  // ============================================
  // DELETE
  // ============================================

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file (Admin only)' })
  @ApiParam({ name: 'key', description: 'S3 object key (URL encoded)' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteFile(@Param('key') key: string): Promise<void> {
    return this.uploadsService.deleteFile(decodeURIComponent(key));
  }
}


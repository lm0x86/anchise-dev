import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InseeSyncService, InseeFileSyncService } from './insee';

// ============================================
// DTOs
// ============================================

class SyncMonthDto {
  @ApiProperty({
    example: '202512',
    description: 'Year and month in YYYYMM format',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Must be in YYYYMM format (e.g., 202512)' })
  yearMonth: string;
}

class SyncYearDto {
  @ApiProperty({
    example: '2025',
    description: 'Year in YYYY format',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Must be in YYYY format (e.g., 2025)' })
  year: string;
}

// ============================================
// Controller
// ============================================

@ApiTags('Integrations')
@Controller('admin/integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private readonly inseeSyncService: InseeSyncService,
    private readonly inseeFileSyncService: InseeFileSyncService,
  ) {}

  // ============================================
  // INSEE API-based Endpoints (matchID)
  // ============================================

  @Get('insee/status')
  @ApiOperation({ summary: 'Get INSEE sync status and recent jobs' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getInseeStatus() {
    return this.inseeFileSyncService.getSyncStatus();
  }

  @Post('insee/sync/month')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a specific month from INSEE/matchID API' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 409, description: 'Sync already in progress' })
  async syncInseeMonth(@Body() dto: SyncMonthDto) {
    const result = await this.inseeSyncService.syncMonth(dto.yearMonth);
    return {
      message: 'Sync completed',
      ...result,
    };
  }

  @Post('insee/sync/year')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a full year from INSEE/matchID API (initial load)' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  @ApiResponse({ status: 409, description: 'Sync already in progress' })
  async syncInseeYear(@Body() dto: SyncYearDto) {
    const result = await this.inseeSyncService.syncYear(dto.year);
    return {
      message: 'Sync completed',
      ...result,
    };
  }

  @Post('insee/sync/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop the current INSEE sync job' })
  @ApiResponse({ status: 200, description: 'Stop signal sent' })
  async stopInseeSync() {
    // Try both services
    let result = await this.inseeFileSyncService.stopSync();
    if (!result.stopped) {
      result = await this.inseeSyncService.stopSync();
    }
    return {
      message: result.stopped ? 'Stop signal sent' : 'No sync in progress',
      ...result,
    };
  }

  // ============================================
  // INSEE Direct File Sync (from insee.fr)
  // ============================================

  @Get('insee/files')
  @ApiOperation({ summary: 'List local INSEE files available for processing' })
  @ApiResponse({ status: 200, description: 'File list retrieved' })
  async listLocalFiles() {
    const files = await this.inseeFileSyncService.getLocalFiles();
    return { files };
  }

  @Get('insee/files/check')
  @ApiOperation({ summary: 'Check INSEE website for new files' })
  @ApiResponse({ status: 200, description: 'New files list' })
  async checkForNewFiles() {
    const newFiles = await this.inseeFileSyncService.checkForNewFiles();
    return {
      count: newFiles.length,
      files: newFiles,
    };
  }

  @Post('insee/files/sync/:fileName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a specific local INSEE file' })
  @ApiResponse({ status: 200, description: 'Sync started/completed' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 409, description: 'Sync already in progress' })
  async syncLocalFile(@Param('fileName') fileName: string) {
    const result = await this.inseeFileSyncService.syncLocalFile(fileName);
    return {
      message: 'Sync completed',
      ...result,
    };
  }

  @Post('insee/files/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download and sync new files from INSEE website' })
  @ApiResponse({ status: 200, description: 'Download and sync started' })
  async downloadAndSyncNewFiles() {
    const newFiles = await this.inseeFileSyncService.checkForNewFiles();

    if (newFiles.length === 0) {
      return {
        message: 'No new files found',
        processed: 0,
      };
    }

    // Process only the most recent monthly file to avoid long-running operations
    const monthlyFiles = newFiles.filter((f) => f.type === 'monthly');
    if (monthlyFiles.length > 0) {
      const mostRecent = monthlyFiles[0];
      const result = await this.inseeFileSyncService.downloadAndProcessFile(mostRecent);
      return {
        message: 'Sync completed',
        ...result,
      };
    }

    return {
      message: 'No monthly files to process',
      processed: 0,
      availableAnnual: newFiles.filter((f) => f.type === 'annual').length,
    };
  }
}


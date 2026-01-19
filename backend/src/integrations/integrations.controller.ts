import {
  Controller,
  Post,
  Get,
  Body,
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
import { InseeSyncService } from './insee';

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
  constructor(private readonly inseeSyncService: InseeSyncService) {}

  // ============================================
  // INSEE Endpoints
  // ============================================

  @Get('insee/status')
  @ApiOperation({ summary: 'Get INSEE sync status and recent jobs' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getInseeStatus() {
    return this.inseeSyncService.getSyncStatus();
  }

  @Post('insee/sync/month')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a specific month from INSEE/matchID' })
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
  @ApiOperation({ summary: 'Sync a full year from INSEE/matchID (initial load)' })
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
    const result = await this.inseeSyncService.stopSync();
    return {
      message: result.stopped ? 'Stop signal sent' : 'No sync in progress',
      ...result,
    };
  }
}


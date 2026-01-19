import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TributesService } from './tributes.service';
import {
  CreateTributeDto,
  UpdateTributeDto,
  ModerateTributeDto,
  TributeQueryDto,
  ModerationQueueQueryDto,
  TributeResponseDto,
  TributeListResponseDto,
  ModerationQueueResponseDto,
} from './dto/tribute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PartnersService } from '../partners/partners.service';
import type { User } from '@prisma/client';

@ApiTags('Tributes')
@Controller('tributes')
export class TributesController {
  constructor(
    private readonly tributesService: TributesService,
    @Inject(forwardRef(() => PartnersService))
    private readonly partnersService: PartnersService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Get()
  @ApiOperation({ summary: 'Get recent approved tributes (community feed)' })
  @ApiResponse({ status: 200, type: TributeListResponseDto })
  async findAll(@Query() query: TributeQueryDto): Promise<TributeListResponseDto> {
    return this.tributesService.findAll(query);
  }

  @Get('profile/:profileId')
  @ApiOperation({ summary: 'Get approved tributes for a profile' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiResponse({ status: 200, type: TributeListResponseDto })
  async findByProfile(
    @Param('profileId') profileId: string,
    @Query() query: TributeQueryDto,
  ): Promise<TributeListResponseDto> {
    return this.tributesService.findByProfile(profileId, query);
  }

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tribute (requires login)' })
  @ApiResponse({ status: 201, type: TributeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async create(
    @Body() dto: CreateTributeDto,
    @CurrentUser() user: User,
  ): Promise<TributeResponseDto> {
    return this.tributesService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your own tribute' })
  @ApiParam({ name: 'id', description: 'Tribute ID' })
  @ApiResponse({ status: 200, type: TributeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Can only edit your own tributes' })
  @ApiResponse({ status: 404, description: 'Tribute not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTributeDto,
    @CurrentUser() user: User,
  ): Promise<TributeResponseDto> {
    return this.tributesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your own tribute' })
  @ApiParam({ name: 'id', description: 'Tribute ID' })
  @ApiResponse({ status: 204, description: 'Tribute deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Can only delete your own tributes' })
  @ApiResponse({ status: 404, description: 'Tribute not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.tributesService.delete(id, user.id, user);
  }

  // ============================================
  // MODERATION ENDPOINTS (Partner/Admin)
  // ============================================

  @Get('moderation/queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get moderation queue (Partner/Admin only)' })
  @ApiResponse({ status: 200, type: ModerationQueueResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Partner/Admin role required' })
  async getModerationQueue(
    @Query() query: ModerationQueueQueryDto,
    @CurrentUser() user: User,
  ): Promise<ModerationQueueResponseDto> {
    const userPartnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.tributesService.getModerationQueue(query, user, userPartnerId);
  }

  @Patch(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate a tribute (Partner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Tribute ID' })
  @ApiResponse({ status: 200, type: TributeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tribute not found' })
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateTributeDto,
    @CurrentUser() user: User,
  ): Promise<TributeResponseDto> {
    const userPartnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.tributesService.moderate(id, dto, user.id, user, userPartnerId);
  }
}


import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
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
import { ProfilesService } from './profiles.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  ProfileQueryDto,
  ProfileResponseDto,
  ProfileListResponseDto,
  BoardProfileDto,
} from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PartnersService } from '../partners/partners.service';
import type { User } from '@prisma/client';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    @Inject(forwardRef(() => PartnersService))
    private readonly partnersService: PartnersService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Get()
  @ApiOperation({ summary: 'List profiles with filters' })
  @ApiResponse({ status: 200, description: 'Profile list', type: ProfileListResponseDto })
  async findAll(@Query() query: ProfileQueryDto): Promise<ProfileListResponseDto> {
    return this.profilesService.findAll(query);
  }

  @Get('board')
  @ApiOperation({ summary: 'Get profiles for funeral board map' })
  @ApiResponse({ status: 200, description: 'Board profiles', type: [BoardProfileDto] })
  async findForBoard(@Query() query: ProfileQueryDto): Promise<BoardProfileDto[]> {
    return this.profilesService.findForBoard(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get profile by ID or slug' })
  @ApiParam({ name: 'idOrSlug', description: 'Profile ID or URL slug' })
  @ApiResponse({ status: 200, description: 'Profile details', type: ProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async findOne(@Param('idOrSlug') idOrSlug: string): Promise<ProfileResponseDto> {
    return this.profilesService.findByIdOrSlug(idOrSlug);
  }

  // ============================================
  // PARTNER ENDPOINTS (require auth)
  // ============================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new profile (Partner/Admin only)' })
  @ApiResponse({ status: 201, description: 'Profile created', type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Partner/Admin role required' })
  async create(
    @Body() dto: CreateProfileDto,
    @CurrentUser() user: User,
  ): Promise<ProfileResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.profilesService.create(dto, partnerId!);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a profile (Partner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Profile ID' })
  @ApiResponse({ status: 200, description: 'Profile updated', type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: User,
  ): Promise<ProfileResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.profilesService.update(id, dto, user, partnerId);
  }
}


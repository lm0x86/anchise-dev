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
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  InviteUserDto,
  PartnerQueryDto,
  PartnerResponseDto,
  PartnerListResponseDto,
  PartnerDashboardDto,
  PartnerUserDto,
  RequestPartnerDto,
  ReviewPartnerDto,
} from './dto/partner.dto';
import { ProfilesService } from '../profiles/profiles.service';
import { ProfileQueryDto, ProfileResponseDto, ProfileListResponseDto } from '../profiles/dto/profile.dto';
import { CreateProfileDto, UpdateProfileDto } from '../profiles/dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('Partners')
@Controller('partners')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly profilesService: ProfilesService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  @Get()
  @ApiOperation({ summary: 'List partners (funeral homes, etc.)' })
  @ApiResponse({ status: 200, type: PartnerListResponseDto })
  async findAll(@Query() query: PartnerQueryDto): Promise<PartnerListResponseDto> {
    return this.partnersService.findAll(query, false); // Public: only approved
  }

  // ============================================
  // USER ENDPOINTS (Become a Partner)
  // ============================================

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request to become a partner (requires admin approval)' })
  @ApiResponse({ status: 201, type: PartnerResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Already have a pending request or partner' })
  async requestPartner(
    @Body() dto: RequestPartnerDto,
    @CurrentUser() user: User,
  ): Promise<PartnerResponseDto> {
    return this.partnersService.requestPartner(dto, user);
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all partners with status filter (Admin only)' })
  @ApiResponse({ status: 200, type: PartnerListResponseDto })
  async findAllAdmin(@Query() query: PartnerQueryDto): Promise<PartnerListResponseDto> {
    return this.partnersService.findAll(query, true); // Admin: can see all statuses
  }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending partner requests (Admin only)' })
  @ApiResponse({ status: 200, type: PartnerListResponseDto })
  async getPendingRequests(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PartnerListResponseDto> {
    return this.partnersService.getPendingRequests(page, limit);
  }

  @Post('admin/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a partner request (Admin only)' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or already reviewed' })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async reviewPartner(
    @Param('id') id: string,
    @Body() dto: ReviewPartnerDto,
  ): Promise<PartnerResponseDto> {
    return this.partnersService.reviewPartner(id, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new partner (Admin only)' })
  @ApiResponse({ status: 201, type: PartnerResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreatePartnerDto): Promise<PartnerResponseDto> {
    return this.partnersService.create(dto);
  }

  // ============================================
  // "MY" ENDPOINTS (Current user's partner)
  // IMPORTANT: These must be defined BEFORE /:id routes!
  // ============================================

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s partner info' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async getMyPartner(@CurrentUser() user: User): Promise<PartnerResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.partnersService.findById(partnerId);
  }

  @Patch('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user\'s partner info' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  async updateMyPartner(
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() user: User,
  ): Promise<PartnerResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.partnersService.update(partnerId, dto, user, partnerId);
  }

  @Get('my/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s partner dashboard' })
  @ApiResponse({ status: 200, type: PartnerDashboardDto })
  async getMyDashboard(@CurrentUser() user: User): Promise<PartnerDashboardDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.partnersService.getDashboard(partnerId, user, partnerId);
  }

  @Get('my/memorials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get memorials for current user\'s partner' })
  @ApiResponse({ status: 200, type: ProfileListResponseDto })
  async getMyMemorials(
    @Query() query: ProfileQueryDto,
    @CurrentUser() user: User,
  ): Promise<ProfileListResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.profilesService.findByPartner(partnerId, query);
  }

  @Post('my/memorials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a memorial for current user\'s partner' })
  @ApiResponse({ status: 201, type: ProfileResponseDto })
  async createMyMemorial(
    @Body() dto: CreateProfileDto,
    @CurrentUser() user: User,
  ): Promise<ProfileResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.profilesService.createForPartner(partnerId, dto);
  }

  @Get('my/memorials/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific memorial for current user\'s partner' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  async getMyMemorial(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<ProfileResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.profilesService.findByIdForPartner(id, partnerId);
  }

  @Patch('my/memorials/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a memorial for current user\'s partner' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  async updateMyMemorial(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: User,
  ): Promise<ProfileResponseDto> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.profilesService.updateForPartner(id, partnerId, dto);
  }

  @Delete('my/memorials/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a memorial for current user\'s partner' })
  @ApiResponse({ status: 200 })
  async deleteMyMemorial(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.profilesService.deleteForPartner(id, partnerId);
  }

  @Get('my/tributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tributes for current user\'s partner memorials' })
  async getMyTributes(
    @Query('status') status: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentUser() user: User,
  ) {
    const partnerId = await this.partnersService.getPartnerIdForUser(user.id);
    if (!partnerId) {
      throw new NotFoundException('You are not associated with any partner organization');
    }
    return this.partnersService.getTributesForPartner(partnerId, status, page, limit);
  }

  // ============================================
  // PARAMETERIZED ENDPOINTS (must be AFTER /my routes)
  // ============================================

  @Get(':id')
  @ApiOperation({ summary: 'Get partner details' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async findOne(@Param('id') id: string): Promise<PartnerResponseDto> {
    return this.partnersService.findById(id);
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get partner dashboard (Partner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiResponse({ status: 200, type: PartnerDashboardDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async getDashboard(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<PartnerDashboardDto> {
    const userPartnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.partnersService.getDashboard(id, user, userPartnerId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update partner details (Partner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiResponse({ status: 200, type: PartnerResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() user: User,
  ): Promise<PartnerResponseDto> {
    const userPartnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.partnersService.update(id, dto, user, userPartnerId);
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PARTNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite an existing user to the partner organization (by email)' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiResponse({ status: 201, type: PartnerUserDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Partner or user not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async inviteUser(
    @Param('id') id: string,
    @Body() dto: InviteUserDto,
    @CurrentUser() user: User,
  ): Promise<PartnerUserDto> {
    const userPartnerId = await this.partnersService.getPartnerIdForUser(user.id);
    return this.partnersService.inviteUser(id, dto, user, userPartnerId);
  }

  @Post(':id/assign/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign an existing user to a partner (Admin only)' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @ApiParam({ name: 'userId', description: 'User ID to assign' })
  @ApiResponse({ status: 201, type: PartnerUserDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Partner or user not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async assignUser(
    @Param('id') partnerId: string,
    @Param('userId') userId: string,
    @Body('role') role?: string,
  ): Promise<PartnerUserDto> {
    const { PartnerRole } = await import('@prisma/client');
    const partnerRole = role && Object.values(PartnerRole).includes(role as any) 
      ? (role as typeof PartnerRole[keyof typeof PartnerRole])
      : PartnerRole.MEMBER;
    return this.partnersService.assignUser(partnerId, userId, partnerRole);
  }
}

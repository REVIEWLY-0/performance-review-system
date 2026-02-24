import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService, CreateUserDto, UpdateUserDto, ImportUsersBodyDto } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all users in company
   */
  @Get()
  async findAll(@CurrentUser() user: any) {
    // CRITICAL: Always filter by company_id
    return this.usersService.findAll(user.companyId);
  }

  /**
   * Get user statistics
   */
  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    return this.usersService.getStats(user.companyId);
  }

  /**
   * Get all managers (for dropdown)
   */
  @Get('managers')
  async getManagers(@CurrentUser() user: any) {
    return this.usersService.getManagers(user.companyId);
  }

  /**
   * Get specific user
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // CRITICAL: Filter by company_id to prevent cross-company access
    return this.usersService.findOne(id, user.companyId);
  }

  /**
   * Create new user (Admin only)
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    // CRITICAL: Auto-assign company_id from authenticated user
    return this.usersService.create(user.companyId, createUserDto);
  }

  /**
   * Import users from Excel (Admin only)
   */
  @Post('import')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importUsers(@Body() body: ImportUsersBodyDto, @CurrentUser() user: any) {
    // CRITICAL: All imports scoped to company_id
    return this.usersService.importUsers(user.companyId, body.users);
  }

  /**
   * Update user (Admin only)
   */
  @Put(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    // CRITICAL: Verify user belongs to company
    return this.usersService.update(id, user.companyId, updateUserDto);
  }

  /**
   * Delete user (Admin only)
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    // CRITICAL: Verify user belongs to company before deletion
    return this.usersService.remove(id, user.companyId);
  }
}

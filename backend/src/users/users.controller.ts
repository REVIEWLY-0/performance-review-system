import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService, CreateUserDto, UpdateUserDto, ImportUsersBodyDto } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all users in company
   */
  @Get()
  async findAll(
    @CompanyId() companyId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.usersService.findAll(companyId, +page, +limit);
  }

  /**
   * Get user statistics
   */
  @Get('stats')
  async getStats(@CompanyId() companyId: string) {
    return this.usersService.getStats(companyId);
  }

  /**
   * Get all managers (for dropdown)
   */
  @Get('managers')
  async getManagers(@CompanyId() companyId: string) {
    return this.usersService.getManagers(companyId);
  }

  /**
   * Get specific user
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.usersService.findOne(id, companyId);
  }

  /**
   * Create new user (Admin only)
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async create(@Body() createUserDto: CreateUserDto, @CompanyId() companyId: string) {
    return this.usersService.create(companyId, createUserDto);
  }

  /**
   * Import users from Excel (Admin only)
   */
  @Post('import')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importUsers(@Body() body: ImportUsersBodyDto, @CompanyId() companyId: string) {
    return this.usersService.importUsers(companyId, body.users);
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
    @CompanyId() companyId: string,
  ) {
    return this.usersService.update(id, companyId, updateUserDto);
  }

  /**
   * Delete user (Admin only)
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async remove(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.usersService.remove(id, companyId);
  }
}

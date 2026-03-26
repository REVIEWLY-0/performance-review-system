import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { UsersService, CreateUserDto, UpdateUserDto, UpdateProfileDto, ImportUsersBodyDto } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
   * Get distinct department names for the company
   */
  @Get('departments')
  async getDepartments(@CompanyId() companyId: string) {
    return this.usersService.getDepartments(companyId);
  }

  /**
   * Update own profile (name) — any authenticated user, no admin required
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() currentUser: { id: string; companyId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(currentUser.id, currentUser.companyId, dto.name);
  }

  /**
   * Upload avatar for own profile — any authenticated user
   * Stores at uploads/avatars/{companyId}/{userId}.{ext}
   * Returns the public URL for immediate use.
   */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req: any, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'avatars', req.user.companyId);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${req.user.id}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        if (allowed.includes(extname(file.originalname).toLowerCase())) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPG, PNG or WebP images are allowed'), false);
        }
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: { id: string; companyId: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = `/uploads/avatars/${currentUser.companyId}/${file.filename}`;
    return this.usersService.updateAvatarUrl(currentUser.id, currentUser.companyId, avatarUrl);
  }

  /**
   * Delete own avatar — any authenticated user
   */
  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(
    @CurrentUser() currentUser: { id: string; companyId: string },
  ) {
    return this.usersService.removeAvatar(currentUser.id, currentUser.companyId);
  }

  /**
   * Get organogram data — all users in company, role-aware field filtering
   * EMPLOYEE: public fields; MANAGER: +email; ADMIN: +email+employeeId
   */
  @Get('organogram')
  async getOrganogram(
    @CompanyId() companyId: string,
    @CurrentUser() currentUser: { id: string; role: string },
  ) {
    return this.usersService.getOrganogramData(companyId, currentUser.role);
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

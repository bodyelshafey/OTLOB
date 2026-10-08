import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { PromoteToDriverDto } from './dto/promote-to-driver.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.usersService.findAll(Number(page) || 1, Number(limit) || 20, search);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string, @CurrentUser('id') actingUserId: string, @ClientIp() ip?: string) {
    return this.usersService.toggleActive(id, actingUserId, ip);
  }

  // Role changes are more sensitive than active/inactive — SUPER_ADMIN only.
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/role')
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser('id') actingUserId: string,
    @ClientIp() ip?: string,
  ) {
    return this.usersService.changeRole(id, dto.role, actingUserId, ip);
  }

  // The only path to becoming a DRIVER — ADMIN/SUPER_ADMIN only. See
  // UsersService.promoteToDriver and DriversController (self-registration
  // removed).
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/promote-to-driver')
  promoteToDriver(
    @Param('id') id: string,
    @Body() dto: PromoteToDriverDto,
    @CurrentUser('id') actingUserId: string,
    @ClientIp() ip?: string,
  ) {
    return this.usersService.promoteToDriver(id, dto, actingUserId, ip);
  }
}

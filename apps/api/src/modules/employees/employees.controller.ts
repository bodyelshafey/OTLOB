import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StoreMemberRole, UserRole } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('stores/:storeId/employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get()
  list(@Param('storeId') storeId: string, @CurrentUser('id') requesterId: string, @CurrentUser('role') role: string) {
    return this.service.listMembers(storeId, requesterId, role);
  }

  @Post()
  add(
    @Param('storeId') storeId: string,
    @CurrentUser('id') requesterId: string,
    @Body() body: { userId: string; role: StoreMemberRole },
  ) {
    return this.service.addMember(storeId, requesterId, body.userId, body.role);
  }

  @Delete(':memberId')
  remove(
    @Param('storeId') storeId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.service.removeMember(storeId, requesterId, memberId);
  }
}

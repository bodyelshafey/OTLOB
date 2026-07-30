import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private service: AddressesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.service.create(userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: Partial<CreateAddressDto>) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('locations')
@Controller()
export class LocationsController {
  constructor(private service: LocationsService) {}

  @Public()
  @Get('zones')
  zones() {
    return this.service.zones();
  }

  @Public()
  @Get('districts')
  districts(@Query('zoneId') zoneId?: string) {
    return this.service.districts(zoneId);
  }
}

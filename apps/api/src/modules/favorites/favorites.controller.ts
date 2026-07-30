import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private service: FavoritesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  add(@CurrentUser('id') userId: string, @Body() dto: CreateFavoriteDto) {
    return this.service.add(userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }
}

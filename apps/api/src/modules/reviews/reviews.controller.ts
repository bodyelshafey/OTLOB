import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private service: ReviewsService) {}

  @Public()
  @Get('store/:storeId')
  findByStore(@Param('storeId') storeId: string) {
    return this.service.findByStore(storeId);
  }

  @ApiBearerAuth()
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.service.create(userId, dto);
  }
}

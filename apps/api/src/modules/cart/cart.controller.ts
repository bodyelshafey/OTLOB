import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private service: CartService) {}

  @Get()
  getCart(@CurrentUser('id') userId: string) {
    return this.service.getCart(userId);
  }

  @Post()
  addItem(@CurrentUser('id') userId: string, @Body() dto: AddToCartDto) {
    return this.service.addItem(userId, dto);
  }

  @Patch(':itemId')
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.service.updateItem(userId, itemId, dto);
  }

  @Delete(':itemId')
  removeItem(@CurrentUser('id') userId: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(userId, itemId);
  }

  @Delete()
  clearCart(@CurrentUser('id') userId: string) {
    return this.service.clearCart(userId);
  }
}

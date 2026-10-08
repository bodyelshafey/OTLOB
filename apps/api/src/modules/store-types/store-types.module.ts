import { Module } from '@nestjs/common';
import { StoreTypesService } from './store-types.service';
import { StoreTypesController } from './store-types.controller';

@Module({
  controllers: [StoreTypesController],
  providers: [StoreTypesService],
})
export class StoreTypesModule {}

import { Module } from '@nestjs/common';
import { DealSizesController } from './deal-sizes.controller';
import { DealSizesService } from './deal-sizes.service';

@Module({
  controllers: [DealSizesController],
  providers: [DealSizesService],
})
export class DealSizesModule {}

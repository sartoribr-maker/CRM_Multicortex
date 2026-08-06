import { PartialType } from '@nestjs/swagger';
import { CreateDealSizeDto } from './create-deal-size.dto';

export class UpdateDealSizeDto extends PartialType(CreateDealSizeDto) {}

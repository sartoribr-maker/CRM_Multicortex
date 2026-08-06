import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ description: 'Obrigatório ao mover o lead para uma etapa de perda' })
  @IsOptional()
  @IsString()
  lossReason?: string;
}

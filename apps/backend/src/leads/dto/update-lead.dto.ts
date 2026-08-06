import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ description: 'Obrigatório ao mover o lead para uma etapa de perda' })
  @IsOptional()
  @IsString()
  lossReason?: string;

  @ApiPropertyOptional({ description: 'Ação realizada na movimentação do funil' })
  @IsOptional()
  @IsString()
  actionDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createTask?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((dto) => dto.createTask === true)
  @IsDateString()
  taskDueDate?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @ValidateIf((dto) => dto.createTask === true)
  @IsEnum(TaskPriority)
  taskPriority?: TaskPriority;
}

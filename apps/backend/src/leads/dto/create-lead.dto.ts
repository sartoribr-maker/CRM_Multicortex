import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadPeriodicity } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CustomFieldValueInputDto } from './custom-field-value-input.dto';

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companySegment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectTypeId?: string;

  @ApiPropertyOptional({ description: 'Se omitido, usa a etapa inicial do funil' })
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dealSizeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  successProbability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional({ enum: LeadPeriodicity })
  @IsOptional()
  @IsEnum(LeadPeriodicity)
  periodicity?: LeadPeriodicity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ description: 'Se omitido, o criador vira o responsável' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CustomFieldValueInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldValueInputDto)
  customFieldValues?: CustomFieldValueInputDto[];
}

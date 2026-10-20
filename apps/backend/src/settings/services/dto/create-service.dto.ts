import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceBillingUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({ enum: ServiceBillingUnit })
  @IsEnum(ServiceBillingUnit)
  billingUnit!: ServiceBillingUnit;

  @ApiPropertyOptional({ description: 'Linha comercial (ex.: GOOD, BEST, TITAN)' })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ description: 'Máquina / VRAM' })
  @IsOptional()
  @IsString()
  hardwareSpec?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Preço descontando imposto' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceWithoutTax?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, description: 'Imposto em fração (0.18 = 18%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  taxRate?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Custo do hardware' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hardwareCost?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Margem de lucro' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  marginValue?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Custo de licença de compilação (único)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  licenseCost?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Setup Private Cloud (único)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  setupPrivateCloudPrice?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Setup On-premises (único)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  setupOnPremisesPrice?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'PoC (único)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pocPrice?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Duração da PoC em dias' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pocDays?: number;

  @ApiPropertyOptional({ description: 'Data de referência da tabela de preços' })
  @IsOptional()
  @IsDateString()
  priceReferenceDate?: string;
}

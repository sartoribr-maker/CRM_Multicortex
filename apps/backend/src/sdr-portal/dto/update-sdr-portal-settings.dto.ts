import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateSdrPortalSettingsDto {
  @ApiProperty({ type: [String], description: 'Etapas para as quais o SDR pode mover um card' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  allowedTargetStageIds!: string[];

  @ApiPropertyOptional({ nullable: true, description: 'Etapa de lead qualificado / reunião agendada' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  qualifiedStageId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Origem aplicada aos leads criados pelo SDR' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  defaultSourceId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Parceiro comercial dos leads do Portal SDR' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  sdrPartnerId?: string | null;

  @ApiProperty({ description: 'Ocultar CAPEX, OPEX, valor estimado e probabilidade no portal' })
  @IsBoolean()
  hideFinancialValues!: boolean;

  @ApiProperty({ minimum: 1, maximum: 365, description: 'Dias sem movimentação para lead parado' })
  @IsInt()
  @Min(1)
  @Max(365)
  staleDays!: number;
}

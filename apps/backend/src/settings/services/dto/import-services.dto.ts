import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Campos enviados em multipart junto com a planilha de precificação. */
export class ImportServicesDto {
  @ApiPropertyOptional({ description: 'Prefixo dos nomes dos serviços (padrão: título da planilha)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productName?: string;

  @ApiPropertyOptional({ description: 'Tipo de produto a relacionar com os serviços importados' })
  @IsOptional()
  @IsUUID()
  projectTypeId?: string;
}

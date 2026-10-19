import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateGoogleCalendarSettingsDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 'multicortex.ai', description: 'Domínio do Google Workspace' })
  @Matches(/^@?[a-z0-9.-]+\.[a-z]{2,}$/i, { message: 'Informe um domínio válido.' })
  workspaceDomain!: string;

  @ApiProperty({ description: 'Agenda usada por quem não tem conta no domínio' })
  @IsEmail()
  fallbackOrganizerEmail!: string;

  @ApiPropertyOptional({ description: 'JSON da chave da conta de serviço; omitido mantém a atual' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  serviceAccountKey?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Etapa cuja entrada sugere agendar reunião' })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID()
  meetingStageId?: string | null;

  @ApiProperty({ minimum: 15, maximum: 480 })
  @IsInt()
  @Min(15)
  @Max(480)
  defaultDurationMinutes!: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLeadMeetingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Início (ISO 8601)' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'Fim (ISO 8601)' })
  @IsDateString()
  endAt!: string;

  @ApiProperty({ type: [String], description: 'E-mails dos convidados' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true, message: 'Convidado com e-mail inválido.' })
  attendees!: string[];

  @ApiProperty({ default: true, description: 'Criar sala do Google Meet' })
  @IsBoolean()
  withMeet!: boolean;
}

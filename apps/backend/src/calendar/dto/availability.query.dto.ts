import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEmail } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({ type: String, description: 'E-mails separados por vírgula (somente do domínio)' })
  @Transform(({ value }) =>
    (Array.isArray(value) ? value : String(value ?? '').split(','))
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true, message: 'E-mail inválido na consulta de disponibilidade.' })
  emails!: string[];

  @ApiProperty({ description: 'Início do período (ISO 8601)' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'Fim do período (ISO 8601)' })
  @IsDateString()
  to!: string;
}

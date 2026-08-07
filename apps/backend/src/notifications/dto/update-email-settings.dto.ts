import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateEmailSettingsDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty() @IsString() @MinLength(3) host!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port!: number;
  @ApiProperty() @IsBoolean() secure!: boolean;
  @ApiProperty() @IsEmail() username!: string;
  @ApiPropertyOptional({ description: 'Deixe vazio para manter a senha atual.' })
  @IsOptional()
  @IsString()
  password?: string;
  @ApiProperty() @IsEmail() fromEmail!: string;
  @ApiProperty() @IsString() @MinLength(2) fromName!: string;
}

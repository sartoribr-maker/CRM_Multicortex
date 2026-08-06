import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  password!: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

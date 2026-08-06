import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  newPassword!: string;
}

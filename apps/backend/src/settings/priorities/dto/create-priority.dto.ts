import { ApiProperty } from '@nestjs/swagger';
import { IsHexColor, IsString, MinLength } from 'class-validator';

export class CreatePriorityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsHexColor()
  color!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsHexColor()
  color!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isWonStage?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isLostStage?: boolean;
}

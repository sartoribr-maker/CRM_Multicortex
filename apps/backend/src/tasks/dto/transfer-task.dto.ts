import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class TransferTaskDto {
  @ApiProperty() @IsUUID() assigneeId!: string;
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}

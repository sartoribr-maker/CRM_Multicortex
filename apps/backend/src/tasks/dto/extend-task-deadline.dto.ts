import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MinLength } from 'class-validator';

export class ExtendTaskDeadlineDto {
  @ApiProperty() @IsDateString() dueDate!: string;
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}

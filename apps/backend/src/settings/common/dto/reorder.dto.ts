import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderDto {
  @ApiProperty({ type: [String], description: 'IDs na nova ordem desejada' })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

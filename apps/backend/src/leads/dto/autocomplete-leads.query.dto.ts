import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class AutocompleteLeadsQueryDto {
  @ApiProperty({ enum: ['company', 'contact'] })
  @IsIn(['company', 'contact'])
  type!: 'company' | 'contact';

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search!: string;
}

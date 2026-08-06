import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CustomFieldValueInputDto {
  @ApiProperty()
  @IsUUID()
  customFieldId!: string;

  @ApiProperty({ description: 'Valor do campo — formato depende do tipo do CustomField' })
  @IsNotEmpty()
  value: unknown;
}

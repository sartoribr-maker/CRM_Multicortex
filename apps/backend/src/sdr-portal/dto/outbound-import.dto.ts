import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, IsString } from 'class-validator';
import { MAX_IMPORT_ROWS } from '../outbound-import/outbound-sheet.parser';

/** Campos multipart chegam como texto: JSON é convertido antes da validação. */
const parseJson = Transform(({ value }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
});

/** Enviado em multipart junto com a planilha, com os campos em JSON. */
export class OutboundImportDto {
  @ApiProperty({ type: [String], description: 'Chaves dos registros marcados para importar' })
  @parseJson
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @IsString({ each: true })
  selectedKeys!: string[];

  @ApiProperty({ description: 'Responsável escolhido por chave de registro (chave → ID do usuário)' })
  @parseJson
  // Os IDs são conferidos no serviço contra os usuários SDR ativos.
  @IsObject()
  ownerOverrides!: Record<string, string>;

  @ApiProperty({ type: [String], description: 'Chaves retiradas da lista de importação' })
  @parseJson
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @IsString({ each: true })
  excludedKeys!: string[];
}

import { BadRequestException } from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';
import { cellDate, cellNumber, cellText, foldName } from '../../../common/spreadsheet';

/** Valores de uma máquina, reunidos de todas as abas da planilha. */
export interface PricingSheetRow {
  tier: string | null;
  hardwareSpec: string;
  price: number | null;
  priceWithoutTax: number | null;
  hardwareCost: number | null;
  marginValue: number | null;
  licenseCost: number | null;
  setupPrivateCloudPrice: number | null;
  setupOnPremisesPrice: number | null;
  pocPrice: number | null;
}

type NumberField = Exclude<keyof PricingSheetRow, 'tier' | 'hardwareSpec'>;
type SheetField = 'tier' | 'hardwareSpec' | NumberField;

/** Parâmetro de cálculo da aba (ex.: "Setup Private Cloud (licenças)" = 1,5x). */
export interface PricingParameter {
  group: string | null;
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'factor' | 'number';
}

/** Conteúdo de uma aba, como aparece na planilha. */
export interface PricingSheetTab {
  name: string;
  title: string | null;
  /** Colunas de valores da aba, na ordem da planilha, com o título original. */
  columns: Array<{ field: NumberField; header: string }>;
  parameters: PricingParameter[];
  notes: string[];
}

export interface PricingSheet {
  /** Texto antes de ":" no título da primeira aba (ex.: "DevCore"). */
  productName: string | null;
  referenceDate: Date | null;
  taxRate: number | null;
  pocDays: number | null;
  rows: PricingSheetRow[];
  tabs: PricingSheetTab[];
}

/**
 * Títulos aceitos por campo (normalizados), comparados pelo início do
 * cabeçalho: "Preço descontando imposto (18%)" casa com "preco descontando imposto".
 */
const HEADER_PREFIXES: Array<[SheetField, string[]]> = [
  ['tier', ['linha']],
  ['hardwareSpec', ['maquina / vram', 'maquina']],
  ['price', ['preco final com imposto', 'preco final']],
  ['priceWithoutTax', ['preco descontando imposto', 'preco sem imposto']],
  ['hardwareCost', ['custo do hardware']],
  ['marginValue', ['margem de lucro', 'margem']],
  ['licenseCost', ['custo de licenca de compilacao', 'licenca de compilacao']],
  ['setupPrivateCloudPrice', ['setup private cloud']],
  ['setupOnPremisesPrice', ['setup on-premises', 'setup on premises', 'setup on-premise']],
  ['pocPrice', ['poc']],
];

const TAX_LABEL = 'imposto sobre o preco final';
const HEADER_SEARCH_ROWS = 15;
const TITLE_ROWS = 3;
export const MAX_PRICING_ROWS = 500;

function fieldForHeader(header: string, taken: Set<SheetField>): SheetField | null {
  const normalized = foldName(header);
  for (const [field, prefixes] of HEADER_PREFIXES) {
    if (!taken.has(field) && prefixes.some((prefix) => normalized.startsWith(prefix))) return field;
  }
  return null;
}

function findHeader(sheet: Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); rowNumber++) {
    const columns = new Map<SheetField, number>();
    const headers = new Map<SheetField, string>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const header = cellText(cell.value);
      if (!header) return;
      const field = fieldForHeader(header, new Set(columns.keys()));
      if (!field) return;
      columns.set(field, column);
      headers.set(field, header);
    });
    if (columns.has('hardwareSpec') && columns.size > 1) return { rowNumber, columns, headers };
  }
  return null;
}

function parameterFormat(numFmt: string | undefined): PricingParameter['format'] {
  if (!numFmt) return 'number';
  if (numFmt.includes('%')) return 'percent';
  if (numFmt.includes('R$')) return 'currency';
  if (/"x"|x$/i.test(numFmt)) return 'factor';
  return 'number';
}

/**
 * Bloco abaixo da tabela: linhas com rótulo e número viram parâmetros; linhas
 * só com texto viram título de grupo (ex.: "Parâmetros de setup") ou nota.
 */
function readParameters(sheet: Worksheet, fromRow: number) {
  const parameters: PricingParameter[] = [];
  const notes: string[] = [];
  let group: string | null = null;
  for (let rowNumber = fromRow; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const label = cellText(row.getCell(1).value);
    if (!label) continue;
    let parameter: PricingParameter | null = null;
    for (let column = 2; column <= row.cellCount && !parameter; column++) {
      const cell = row.getCell(column);
      const value = cellNumber(cell.value);
      if (value !== null) parameter = { group, label, value, format: parameterFormat(cell.numFmt) };
    }
    if (parameter) parameters.push(parameter);
    else if (foldName(label).startsWith('parametros')) group = label;
    else notes.push(label);
  }
  return { parameters, notes };
}

function rowKey(tier: string | null, hardwareSpec: string): string {
  return `${foldName(tier ?? '')}|${foldName(hardwareSpec)}`;
}

/** Valor ao lado de um rótulo (primeiro número na mesma linha). */
function labeledNumber(sheet: Worksheet, label: string): number | null {
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const first = cellText(row.getCell(1).value);
    if (!first || !foldName(first).startsWith(label)) continue;
    for (let column = 2; column <= row.cellCount; column++) {
      const value = cellNumber(row.getCell(column).value);
      if (value !== null) return value;
    }
  }
  return null;
}

/** Título e data de referência nas primeiras linhas da aba. */
function readTitle(sheet: Worksheet) {
  let productName: string | null = null;
  let title: string | null = null;
  let referenceDate: Date | null = null;
  for (let rowNumber = 1; rowNumber <= Math.min(TITLE_ROWS, sheet.rowCount); rowNumber++) {
    sheet.getRow(rowNumber).eachCell((cell) => {
      referenceDate ??= cellDate(cell.value);
      const text = cellText(cell.value);
      if (!title && text?.includes(':')) {
        title = text;
        productName = text.split(':')[0].trim() || null;
      }
    });
  }
  return { productName, title, referenceDate };
}

export async function parsePricingSheet(buffer: Buffer): Promise<PricingSheet> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('Não foi possível ler a planilha. Envie um arquivo .xlsx válido.');
  }

  const rows = new Map<string, PricingSheetRow>();
  const result: PricingSheet = {
    productName: null,
    referenceDate: null,
    taxRate: null,
    pocDays: null,
    rows: [],
    tabs: [],
  };

  for (const sheet of workbook.worksheets) {
    const header = findHeader(sheet);
    if (!header) continue;
    if (!result.productName && !result.referenceDate) {
      const { productName, referenceDate } = readTitle(sheet);
      Object.assign(result, { productName, referenceDate });
    }
    result.taxRate ??= labeledNumber(sheet, TAX_LABEL);
    const pocDays = header.headers.get('pocPrice')?.match(/(\d+)\s*dias?/i);
    if (pocDays) result.pocDays ??= Number(pocDays[1]);

    // Linhas de dados até a primeira sem "Máquina / VRAM".
    let rowNumber = header.rowNumber + 1;
    for (; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const read = (field: SheetField) => {
        const column = header.columns.get(field);
        return column ? row.getCell(column).value : null;
      };
      const hardwareSpec = cellText(read('hardwareSpec'));
      if (!hardwareSpec) break;
      const tier = cellText(read('tier'));
      const key = rowKey(tier, hardwareSpec);
      const entry = rows.get(key) ?? {
        tier,
        hardwareSpec,
        price: null,
        priceWithoutTax: null,
        hardwareCost: null,
        marginValue: null,
        licenseCost: null,
        setupPrivateCloudPrice: null,
        setupOnPremisesPrice: null,
        pocPrice: null,
      };
      for (const field of header.columns.keys()) {
        if (field === 'tier' || field === 'hardwareSpec') continue;
        entry[field] ??= cellNumber(read(field));
      }
      rows.set(key, entry);
      if (rows.size > MAX_PRICING_ROWS) {
        throw new BadRequestException(`A planilha excede o limite de ${MAX_PRICING_ROWS} itens.`);
      }
    }

    result.tabs.push({
      name: sheet.name,
      title: readTitle(sheet).title,
      columns: [...header.columns.entries()]
        .filter((entry): entry is [NumberField, number] => !['tier', 'hardwareSpec'].includes(entry[0]))
        .sort((a, b) => a[1] - b[1])
        .map(([field]) => ({ field, header: header.headers.get(field)! })),
      ...readParameters(sheet, rowNumber),
    });
  }

  if (!rows.size) {
    throw new BadRequestException(
      'Nenhuma tabela de preços encontrada. A planilha precisa ter as colunas "Máquina / VRAM" e "Preço final com imposto".',
    );
  }
  result.rows = [...rows.values()];
  return result;
}

/** Planilha modelo, no mesmo formato aceito pela importação. */
export async function buildPricingTemplate(): Promise<Buffer> {
  const workbook = new Workbook();
  const prices = workbook.addWorksheet('Preços');
  prices.addRow(['Produto: preços e margens', '', '', '', '', '', new Date()]);
  prices.addRow(['Valores em reais (R$). Preço final = mensalidade com imposto.']);
  prices.addRow([]);
  prices.addRow([
    'Linha',
    'Máquina / VRAM',
    'Preço final com imposto',
    'Preço descontando imposto',
    'Custo do hardware',
    'Margem de lucro',
  ]);
  // Linha de exemplo com valores fictícios: substitua pelos itens reais.
  prices.addRow(['EXEMPLO', 'GPU — 00 GB', 1000, 820, 500, 320]);
  prices.addRow([]);
  prices.addRow(['Parâmetros de cálculo']);
  prices.addRow(['Imposto sobre o preço final', '', 0.18]);

  const license = workbook.addWorksheet('Licença');
  license.addRow(['Produto: licença e implantação']);
  license.addRow(['Valores em reais (R$). Cobranças únicas.']);
  license.addRow([]);
  license.addRow([
    'Linha',
    'Máquina / VRAM',
    'Custo de licença de compilação',
    'Setup Private Cloud',
    'Setup On-premises',
    'PoC (15 dias)',
  ]);
  license.addRow(['EXEMPLO', 'GPU — 00 GB', 377.6, 566.4, 944, 590]);

  for (const sheet of [prices, license]) {
    sheet.getRow(4).font = { bold: true };
    sheet.columns.forEach((column) => (column.width = 26));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

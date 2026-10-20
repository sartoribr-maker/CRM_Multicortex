import { BadRequestException } from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';
import { cellText, foldName } from '../../common/spreadsheet';
import { normalizeEmail, normalizeName } from '../../companies/company-contact.normalize';

/** Colunas reconhecidas na planilha de leads Outbound. */
export interface OutboundSheetRow {
  rowNumber: number;
  sdrName: string | null;
  contactName: string | null;
  contactPosition: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
  companyName: string | null;
  companyLocation: string | null;
  companyLinkedinUrl: string | null;
  companyWebsite: string | null;
  companyPhone: string | null;
  companySizeEstimate: string | null;
  adherence: string | null;
  companyRevenue: string | null;
  companyEmployeeCount: string | null;
}

type SheetField = Exclude<keyof OutboundSheetRow, 'rowNumber'>;

/** Títulos aceitos por campo, já normalizados (minúsculas, sem acentos). */
const HEADER_ALIASES: Record<SheetField, string[]> = {
  sdrName: ['sdr responsavel', 'sdr', 'responsavel'],
  contactName: ['nome', 'contato', 'nome do contato'],
  contactPosition: ['cargo'],
  contactEmail: ['e-mail lead', 'email lead', 'e-mail', 'email'],
  contactPhone: ['telefone lead', 'telefone'],
  contactLinkedinUrl: ['link linkedin do contato', 'linkedin do contato'],
  companyName: ['empresa'],
  companyLocation: ['localizacao'],
  companyLinkedinUrl: ['link linkedin da empresa', 'linkedin da empresa'],
  companyWebsite: ['site empresa', 'site da empresa', 'site'],
  companyPhone: ['telefone empresa', 'telefone da empresa'],
  companySizeEstimate: ['porte / faturamento estimado', 'porte'],
  adherence: ['aderencia ao cargo-alvo', 'aderencia'],
  companyRevenue: ['faturamento empresa', 'faturamento da empresa', 'faturamento'],
  companyEmployeeCount: ['qtde de funcionarios', 'quantidade de funcionarios', 'funcionarios'],
};

const HEADER_SEARCH_ROWS = 10;
export const MAX_IMPORT_ROWS = 5000;

function findHeader(sheet: Worksheet): { rowNumber: number; columns: Map<SheetField, number> } | null {
  for (let rowNumber = 1; rowNumber <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); rowNumber++) {
    const columns = new Map<SheetField, number>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const header = cellText(cell.value);
      if (!header) return;
      const normalized = foldName(header);
      const field = (Object.keys(HEADER_ALIASES) as SheetField[]).find(
        (key) => !columns.has(key) && HEADER_ALIASES[key].includes(normalized),
      );
      if (field) columns.set(field, column);
    });
    if (columns.has('contactName') && columns.has('companyName')) return { rowNumber, columns };
  }
  return null;
}

export async function parseOutboundSheet(buffer: Buffer): Promise<OutboundSheetRow[]> {
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('Não foi possível ler a planilha. Envie um arquivo .xlsx válido.');
  }

  for (const sheet of workbook.worksheets) {
    const header = findHeader(sheet);
    if (!header) continue;

    const rows: OutboundSheetRow[] = [];
    for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = Object.fromEntries(
        (Object.keys(HEADER_ALIASES) as SheetField[]).map((field) => {
          const column = header.columns.get(field);
          return [field, column ? cellText(row.getCell(column).value) : null];
        }),
      ) as Record<SheetField, string | null>;
      if (!values.contactName && !values.companyName) continue;
      rows.push({ rowNumber, ...values });
      if (rows.length > MAX_IMPORT_ROWS) {
        throw new BadRequestException(`A planilha excede o limite de ${MAX_IMPORT_ROWS} registros.`);
      }
    }
    return rows;
  }

  throw new BadRequestException(
    'Cabeçalho não encontrado. A planilha precisa ter ao menos as colunas "Nome" e "Empresa".',
  );
}

/** Sem protocolo, "www", parâmetros e barra final; só o domínio em minúsculas (IDs do LinkedIn diferenciam caixa). */
function normalizeUrl(value: string): string {
  const url = value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  const slash = url.indexOf('/');
  return slash === -1 ? url.toLowerCase() : url.slice(0, slash).toLowerCase() + url.slice(slash);
}

/**
 * Identifica o registro na blacklist: LinkedIn do contato; senão e-mail;
 * senão nome + empresa.
 */
export function blacklistKey(row: OutboundSheetRow): string | null {
  if (row.contactLinkedinUrl) return `linkedin:${normalizeUrl(row.contactLinkedinUrl)}`;
  const email = normalizeEmail(row.contactEmail);
  if (email) return `email:${email}`;
  if (row.contactName && row.companyName) {
    return `nome:${normalizeName(row.contactName)}|${normalizeName(row.companyName)}`;
  }
  return null;
}


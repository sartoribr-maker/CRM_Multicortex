import type { CellValue } from 'exceljs';
import { cleanText } from '../companies/company-contact.normalize';

/** Comparação de nomes e títulos sem acentos e sem diferenciar maiúsculas. */
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto exibido na célula: hiperlinks, rich text e fórmulas viram texto simples. */
export function cellText(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return cleanText(value.richText.map((part) => part.text).join(''));
    if ('hyperlink' in value) {
      const text = typeof value.text === 'string' ? value.text : null;
      return cleanText(text ?? value.hyperlink);
    }
    if ('result' in value) return cellText(value.result as CellValue);
    if ('error' in value) return null;
  }
  return cleanText(String(value));
}

/** Valor numérico da célula (inclusive resultado de fórmula); senão null. */
export function cellNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object' && 'result' in value) {
    return cellNumber(value.result as CellValue);
  }
  return null;
}

/** Data da célula (inclusive resultado de fórmula); senão null. */
export function cellDate(value: CellValue): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'result' in value) {
    return cellDate(value.result as CellValue);
  }
  return null;
}

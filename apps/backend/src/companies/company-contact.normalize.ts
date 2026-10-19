/** Texto aparado e com espaços internos colapsados; vazio vira null. */
export function cleanText(value?: string | null): string | null {
  const text = value?.trim().replace(/\s+/g, ' ');
  return text ? text : null;
}

/** Chave de duplicidade por nome (mesma regra da migration de importação). */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeEmail(value?: string | null): string | null {
  const email = cleanText(value);
  return email ? email.toLowerCase() : null;
}

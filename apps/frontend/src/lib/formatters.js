export function formatDate(value) {
    if (!value)
        return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value).slice(0, 10)) && String(value).length === 10
        ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        : date.toLocaleDateString('pt-BR');
}
export function isoToBrazilianDate(value) {
    if (!value)
        return '';
    const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}
export function maskDate(value) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}
export function brazilianDateToIso(value) {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match)
        return null;
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month}-${day}T12:00:00`);
    if (date.getFullYear() !== Number(year) ||
        date.getMonth() + 1 !== Number(month) ||
        date.getDate() !== Number(day))
        return null;
    return `${year}-${month}-${day}`;
}
export function formatPhone(value) {
    if (!value)
        return '—';
    const hasBrazilCountryCode = value.replace(/\D/g, '').length > 11;
    let digits = value.replace(/\D/g, '').slice(0, 13);
    let prefix = '';
    if (hasBrazilCountryCode && digits.startsWith('55')) {
        digits = digits.slice(2);
        prefix = '+55 ';
    }
    digits = digits.slice(0, 11);
    if (digits.length <= 2)
        return `${prefix}(${digits}`;
    const area = digits.slice(0, 2);
    const number = digits.slice(2);
    const split = number.length > 8 ? 5 : 4;
    return `${prefix}(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ''}`;
}
export function formatCurrency(value) {
    if (value === null || value === undefined || value === '')
        return '—';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function currencyInputValue(value) {
    if (value === null || value === undefined || Number.isNaN(value))
        return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function parseCurrencyInput(value) {
    const digits = value.replace(/\D/g, '');
    return digits ? Number(digits) / 100 : undefined;
}

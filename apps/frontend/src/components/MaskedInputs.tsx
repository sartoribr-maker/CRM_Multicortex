import { useEffect, useState, type InputHTMLAttributes } from 'react';
import {
  brazilianDateToIso,
  currencyInputValue,
  formatPhone,
  isoToBrazilianDate,
  maskDate,
  parseCurrencyInput,
} from '../lib/formatters';

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

export function PhoneInput({
  value,
  onValueChange,
  ...props
}: BaseProps & {
  value?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      value={value ? formatPhone(value) : ''}
      onChange={(event) => onValueChange(event.target.value.replace(/\D/g, '').slice(0, 13))}
    />
  );
}

export function CurrencyInput({
  value,
  onValueChange,
  ...props
}: BaseProps & {
  value?: number;
  onValueChange: (value: number | undefined) => void;
}) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={currencyInputValue(value)}
      onChange={(event) => onValueChange(parseCurrencyInput(event.target.value))}
    />
  );
}

export function DateInput({
  value,
  onValueChange,
  ...props
}: BaseProps & {
  value?: string;
  onValueChange: (value: string | undefined) => void;
}) {
  const [display, setDisplay] = useState(() => isoToBrazilianDate(value));
  useEffect(() => setDisplay(isoToBrazilianDate(value)), [value]);
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      pattern="\d{2}/\d{2}/\d{4}"
      maxLength={10}
      value={display}
      onBlur={(event) => {
        event.currentTarget.setCustomValidity(
          display && !brazilianDateToIso(display)
            ? 'Informe uma data válida no formato dd/mm/aaaa.'
            : '',
        );
        props.onBlur?.(event);
      }}
      onChange={(event) => {
        const masked = maskDate(event.target.value);
        setDisplay(masked);
        event.currentTarget.setCustomValidity('');
        if (!masked) onValueChange(undefined);
        else {
          const iso = brazilianDateToIso(masked);
          if (iso) onValueChange(iso);
        }
      }}
    />
  );
}

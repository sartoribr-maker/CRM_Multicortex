import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { customFieldsApi } from '../lib/settingsApi';
import { CurrencyInput, DateInput } from './MaskedInputs';
const inputClass = 'form-control';
export function CustomFieldsFormSection({ values, onChange }) {
    const [fields, setFields] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        customFieldsApi
            .list()
            .then((all) => setFields(all.filter((field) => field.showInForm)))
            .finally(() => setIsLoading(false));
    }, []);
    if (isLoading)
        return null;
    if (fields.length === 0)
        return null;
    function getValue(fieldId) {
        return values.find((v) => v.customFieldId === fieldId)?.value;
    }
    function setValue(fieldId, value) {
        const next = values.filter((v) => v.customFieldId !== fieldId);
        next.push({ customFieldId: fieldId, value });
        onChange(next);
    }
    return (_jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h3", { className: "font-heading text-base font-bold text-slate-800", children: "Campos personalizados" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Informa\u00E7\u00F5es adicionais configuradas para sua opera\u00E7\u00E3o." })] }), _jsx("div", { className: "form-section-body", children: fields.map((field) => {
                    const value = getValue(field.id);
                    const label = `${field.name}${field.isRequired ? ' *' : ''}`;
                    if (field.type === 'BOOLEAN') {
                        return (_jsxs("label", { className: "flex items-center gap-2 text-sm text-ink", children: [_jsx("input", { type: "checkbox", checked: Boolean(value), onChange: (e) => setValue(field.id, e.target.checked) }), label] }, field.id));
                    }
                    if (field.type === 'SINGLE_SELECT') {
                        return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsxs("select", { required: field.isRequired, className: inputClass, value: value ?? '', onChange: (e) => setValue(field.id, e.target.value), children: [_jsx("option", { value: "", disabled: true, children: "Selecione\u2026" }), (field.options ?? []).map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }, field.id));
                    }
                    if (field.type === 'MULTI_SELECT') {
                        const selected = Array.isArray(value) ? value : [];
                        return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsx("div", { className: "flex flex-wrap gap-3", children: (field.options ?? []).map((option) => (_jsxs("label", { className: "flex items-center gap-1.5 text-sm text-ink", children: [_jsx("input", { type: "checkbox", checked: selected.includes(option), onChange: (e) => {
                                                    const next = e.target.checked
                                                        ? [...selected, option]
                                                        : selected.filter((o) => o !== option);
                                                    setValue(field.id, next);
                                                } }), option] }, option))) })] }, field.id));
                    }
                    if (field.type === 'DATE') {
                        return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsx(DateInput, { required: field.isRequired, className: inputClass, value: value ?? '', onValueChange: (next) => setValue(field.id, next ?? '') })] }, field.id));
                    }
                    if (field.type === 'CURRENCY') {
                        return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsx(CurrencyInput, { required: field.isRequired, className: inputClass, value: value === null || value === undefined ? undefined : Number(value), onValueChange: (next) => setValue(field.id, next ?? '') })] }, field.id));
                    }
                    if (field.type === 'NUMBER') {
                        return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsx("input", { type: "number", required: field.isRequired, className: inputClass, value: typeof value === 'number' ? value : '', onChange: (e) => setValue(field.id, e.target.value === '' ? undefined : Number(e.target.value)) })] }, field.id));
                    }
                    return (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: label }), _jsx("input", { type: "text", required: field.isRequired, className: inputClass, value: value ?? '', onChange: (e) => setValue(field.id, e.target.value) })] }, field.id));
                }) })] }));
}

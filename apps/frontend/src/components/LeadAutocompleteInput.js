import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { leadsApi } from '../lib/leadsApi';
export function LeadAutocompleteInput({ type, value, onChange, onSelect }) {
    const listboxId = useId();
    const [options, setOptions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => {
        const search = value.trim();
        if (search.length < 2) {
            setOptions([]);
            setIsOpen(false);
            return;
        }
        let isCurrent = true;
        const timeout = window.setTimeout(() => {
            leadsApi
                .autocomplete(type, search)
                .then((items) => {
                if (!isCurrent)
                    return;
                setOptions(items);
                setActiveIndex(0);
                setIsOpen(items.length > 0);
            })
                .catch(() => {
                if (isCurrent)
                    setOptions([]);
            });
        }, 250);
        return () => {
            isCurrent = false;
            window.clearTimeout(timeout);
        };
    }, [type, value]);
    function select(option) {
        onSelect(option);
        setOptions([]);
        setIsOpen(false);
    }
    function handleKeyDown(event) {
        if (!isOpen || options.length === 0)
            return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % options.length);
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + options.length) % options.length);
        }
        else if (event.key === 'Enter') {
            event.preventDefault();
            select(options[activeIndex]);
        }
        else if (event.key === 'Escape') {
            setIsOpen(false);
        }
    }
    return (_jsxs("div", { className: "relative", children: [_jsx("input", { className: "form-control", value: value, autoComplete: "off", role: "combobox", "aria-autocomplete": "list", "aria-expanded": isOpen, "aria-controls": listboxId, "aria-activedescendant": isOpen ? `${listboxId}-${activeIndex}` : undefined, onChange: (event) => onChange(event.target.value), onFocus: () => options.length > 0 && setIsOpen(true), onBlur: () => window.setTimeout(() => setIsOpen(false), 100), onKeyDown: handleKeyDown }), isOpen && (_jsx("ul", { id: listboxId, role: "listbox", className: "absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg", children: options.map((option, index) => {
                    const title = type === 'company' ? option.companyName : option.contactName;
                    const details = type === 'company'
                        ? option.companyDocument || 'Documento não informado'
                        : [option.contactEmail, option.contactPhone].filter(Boolean).join(' · ') ||
                            'Contato sem e-mail ou telefone';
                    return (_jsxs("li", { id: `${listboxId}-${index}`, role: "option", "aria-selected": index === activeIndex, className: `cursor-pointer rounded-lg px-3 py-2 ${index === activeIndex ? 'bg-primary/10 text-primary-dark' : 'hover:bg-slate-50'}`, onMouseDown: (event) => event.preventDefault(), onMouseEnter: () => setActiveIndex(index), onClick: () => select(option), children: [_jsx("p", { className: "text-sm font-semibold", children: title }), _jsx("p", { className: "mt-0.5 truncate text-xs text-slate-500", children: details })] }, `${title}-${details}`));
                }) }))] }));
}

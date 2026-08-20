import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { PhoneInput } from '../../components/MaskedInputs';
import { formatPhone } from '../../lib/formatters';
import { rolesApi } from '../../lib/rolesApi';
import { avatarUrl, usersApi, } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MODULE_LABELS = {
    users: 'Usuários',
    roles: 'Perfis de acesso',
    settings: 'Configurações',
    leads: 'Leads e oportunidades',
    partners: 'Parceiros',
    tasks: 'Tarefas',
    dashboard: 'Dashboard',
};
function Modal({ title, description, children, onClose, }) {
    return (_jsx("div", { className: "mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "mobile-modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl", children: [_jsxs("div", { className: "sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white p-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-xl font-bold text-slate-900", children: title }), description && _jsx("p", { className: "mt-1 text-xs text-slate-400", children: description })] }), _jsx("button", { className: "icon-button", onClick: onClose, children: _jsx(Icon, { name: "x", className: "h-5 w-5" }) })] }), children] }) }));
}
export default function AccessManagementPage() {
    const current = useAuthStore((s) => s.user);
    const canManageRoles = current?.permissions.includes('roles.manage') ?? false;
    const canCreate = current?.permissions.includes('users.create') ?? false;
    const canEdit = current?.permissions.includes('users.edit') ?? false;
    const canDelete = current?.permissions.includes('users.delete') ?? false;
    const [tab, setTab] = useState('users');
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [editingRole, setEditingRole] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    function loadRoles() {
        Promise.all([rolesApi.list(), rolesApi.permissions()])
            .then(([r, p]) => {
            setRoles(r);
            setPermissions(p);
        })
            .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar perfis.'));
    }
    function loadUsers() {
        setLoading(true);
        usersApi
            .listPage(filters)
            .then((r) => {
            setUsers(r.items);
            setTotal(r.total);
        })
            .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar usuários.'))
            .finally(() => setLoading(false));
    }
    useEffect(loadRoles, []);
    useEffect(loadUsers, [filters]);
    async function status(user) {
        try {
            await (user.status === 'ACTIVE'
                ? usersApi.deactivate(user.id)
                : usersApi.reactivate(user.id));
            loadUsers();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao alterar status.');
        }
    }
    async function reset(user) {
        const password = window.prompt(`Nova senha para ${user.name} (mínimo 8 caracteres):`);
        if (!password)
            return;
        if (password.length < 8) {
            setError('A senha deve ter ao menos 8 caracteres.');
            return;
        }
        try {
            await usersApi.resetPassword(user.id, password);
            window.alert('Senha redefinida com sucesso.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao redefinir senha.');
        }
    }
    async function removeUser(user) {
        const confirmed = window.confirm(`Excluir permanentemente o usuário "${user.name}"?\n\nEsta ação não poderá ser desfeita.`);
        if (!confirmed)
            return;
        setError(null);
        try {
            await usersApi.remove(user.id);
            loadUsers();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao excluir usuário.');
        }
    }
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Administra\u00E7\u00E3o", title: "Usu\u00E1rios e acessos", description: "Gerencie pessoas, perfis e permiss\u00F5es de toda a plataforma.", actions: (tab === 'users' ? canCreate : canManageRoles) && (_jsxs("button", { className: "btn-primary", onClick: () => (tab === 'users' ? setEditingUser('new') : setEditingRole('new')), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), tab === 'users' ? 'Novo usuário' : 'Novo perfil'] })) }), _jsxs("div", { className: "mb-5 flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm", children: [_jsx("button", { className: `rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'users' ? 'bg-brand-purple text-white' : 'text-slate-500'}`, onClick: () => setTab('users'), children: "Usu\u00E1rios" }), _jsx("button", { className: `rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'roles' ? 'bg-brand-purple text-white' : 'text-slate-500'}`, onClick: () => setTab('roles'), children: "Perfis e permiss\u00F5es" })] }), error && (_jsxs("div", { className: "mb-4 flex justify-between rounded-xl bg-red-50 p-3 text-sm text-red-600", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: _jsx(Icon, { name: "x", className: "h-4 w-4" }) })] })), tab === 'users' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "filter-panel", children: _jsxs("div", { className: "grid gap-3 md:grid-cols-[1fr_220px_180px]", children: [_jsxs("div", { className: "relative", children: [_jsx(Icon, { name: "search", className: "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" }), _jsx("input", { className: "form-control pl-10", placeholder: "Buscar por nome ou e-mail...", value: filters.search ?? '', onChange: (e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 1 })) })] }), _jsxs("select", { className: "form-control", value: filters.roleId ?? '', onChange: (e) => setFilters((f) => ({ ...f, roleId: e.target.value || undefined, page: 1 })), children: [_jsx("option", { value: "", children: "Todos os perfis" }), roles.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id)))] }), _jsxs("select", { className: "form-control", value: filters.status ?? '', onChange: (e) => setFilters((f) => ({
                                        ...f,
                                        status: (e.target.value || undefined),
                                        page: 1,
                                    })), children: [_jsx("option", { value: "", children: "Todos os status" }), _jsx("option", { value: "ACTIVE", children: "Ativos" }), _jsx("option", { value: "INACTIVE", children: "Inativos" })] })] }) }), _jsx("div", { className: "table-shell overflow-x-auto", children: loading ? (_jsx("p", { className: "p-12 text-center text-sm text-slate-400", children: "Carregando usu\u00E1rios\u2026" })) : (_jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Usu\u00E1rio" }), _jsx("th", { children: "Perfil" }), _jsx("th", { children: "Cargo" }), _jsx("th", { children: "Telefone" }), _jsx("th", { children: "Status" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: users.map((u) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { className: "flex items-center gap-3", children: [u.avatarUrl ? (_jsx("img", { src: avatarUrl(u.id, u.avatarUrl), alt: `Foto de ${u.name}`, className: "h-9 w-9 rounded-xl object-cover" })) : (_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-xs font-bold text-brand-purple", children: u.name
                                                                .split(' ')
                                                                .slice(0, 2)
                                                                .map((p) => p[0])
                                                                .join('')
                                                                .toUpperCase() })), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-800", children: u.name }), _jsx("p", { className: "text-xs text-slate-400", children: u.email })] })] }) }), _jsx("td", { children: _jsx("span", { className: "rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold", children: u.role.name }) }), _jsx("td", { children: u.position || '—' }), _jsx("td", { children: formatPhone(u.phone) }), _jsx("td", { children: _jsxs("span", { className: `inline-flex items-center gap-2 text-xs font-bold ${u.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`, children: [_jsx("span", { className: `status-dot ${u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}` }), u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'] }) }), _jsx("td", { children: _jsxs("div", { className: "flex justify-end gap-1", children: [canEdit && (_jsxs(_Fragment, { children: [_jsx("button", { className: "icon-button", title: "Editar", onClick: () => setEditingUser(u), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { className: "icon-button", title: "Redefinir senha", onClick: () => reset(u), children: _jsx(Icon, { name: "settings", className: "h-4 w-4" }) })] })), (canDelete || canEdit) && (_jsx("button", { disabled: u.id === current?.id, className: "icon-button disabled:opacity-30", title: u.status === 'ACTIVE' ? 'Inativar' : 'Reativar', onClick: () => status(u), children: _jsx(Icon, { name: u.status === 'ACTIVE' ? 'archive' : 'view', className: "h-4 w-4" }) })), canDelete && (_jsx("button", { disabled: u.id === current?.id, className: "icon-button hover:!bg-red-50 hover:!text-red-600 disabled:opacity-30", title: "Excluir permanentemente", onClick: () => removeUser(u), children: _jsx(Icon, { name: "trash", className: "h-4 w-4" }) }))] }) })] }, u.id))) })] })) }), _jsxs("p", { className: "mt-3 text-xs text-slate-400", children: [total, " usu\u00E1rio(s) encontrado(s)."] })] })) : (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[340px_1fr]", children: [_jsx("div", { className: "space-y-3", children: roles.map((role) => (_jsxs("button", { onClick: () => setSelectedRole(role), className: `card w-full p-4 text-left transition ${selectedRole?.id === role.id ? 'border-brand-purple ring-2 ring-purple-100' : ''}`, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-800", children: role.name }), _jsx("p", { className: "mt-1 line-clamp-2 text-xs leading-5 text-slate-400", children: role.description || 'Sem descrição' })] }), role.isSystem && (_jsx("span", { className: "rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500", children: "Sistema" }))] }), _jsxs("p", { className: "mt-3 text-[11px] font-semibold text-brand-purple", children: [role.permissions.length, " permiss\u00F5es"] })] }, role.id))) }), _jsx(RoleMatrix, { role: selectedRole ?? roles[0] ?? null, permissions: permissions, canManage: canManageRoles, onSaved: (role) => {
                            setRoles((c) => c.map((r) => (r.id === role.id ? role : r)));
                            setSelectedRole(role);
                        }, onEdit: setEditingRole, onRemove: async (role) => {
                            if (window.confirm(`Excluir o perfil ${role.name}?`)) {
                                try {
                                    await rolesApi.remove(role.id);
                                    setSelectedRole(null);
                                    loadRoles();
                                }
                                catch (e) {
                                    setError(e instanceof Error ? e.message : 'Erro ao excluir perfil.');
                                }
                            }
                        } })] })), editingUser && (_jsx(UserForm, { user: editingUser, roles: roles, onClose: () => setEditingUser(null), onSaved: () => {
                    setEditingUser(null);
                    loadUsers();
                } })), editingRole && (_jsx(RoleForm, { role: editingRole, onClose: () => setEditingRole(null), onSaved: () => {
                    setEditingRole(null);
                    loadRoles();
                } }))] }));
}
function UserForm({ user, roles, onClose, onSaved, }) {
    const isNew = user === 'new';
    const [form, setForm] = useState(isNew
        ? { name: '', email: '', password: '', roleId: '', mustChangePassword: false }
        : {
            name: user.name,
            email: user.email,
            roleId: user.roleId,
            position: user.position ?? undefined,
            phone: user.phone ?? undefined,
            mustChangePassword: user.mustChangePassword,
        });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const currentUser = useAuthStore((state) => state.user);
    const accessToken = useAuthStore((state) => state.accessToken);
    const setSession = useAuthStore((state) => state.setSession);
    function handleAvatarChange(file) {
        setError(null);
        if (!file) {
            setAvatarFile(null);
            return;
        }
        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            setAvatarFile(null);
            setError('Selecione uma imagem nos formatos JPG, PNG ou WebP.');
            return;
        }
        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            setAvatarFile(null);
            setError('A foto deve ter no máximo 5 MB.');
            return;
        }
        setAvatarFile(file);
    }
    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            let saved = isNew ? await usersApi.create(form) : await usersApi.update(user.id, form);
            if (avatarFile)
                saved = await usersApi.uploadAvatar(saved.id, avatarFile);
            if (currentUser?.id === saved.id && accessToken) {
                setSession(accessToken, { ...currentUser, avatarUrl: saved.avatarUrl });
            }
            onSaved();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx(Modal, { title: isNew ? 'Novo usuário' : 'Editar usuário', description: "Dados pessoais e perfil de acesso.", onClose: onClose, children: _jsxs("form", { onSubmit: submit, className: "grid gap-4 p-5 md:grid-cols-2", children: [_jsxs("div", { className: "flex items-center gap-4 md:col-span-2", children: [avatarFile || (!isNew && user.avatarUrl) ? (_jsx("img", { src: avatarFile
                                ? URL.createObjectURL(avatarFile)
                                : avatarUrl(user.id, user.avatarUrl), alt: "Pr\u00E9via da foto", className: "h-20 w-20 rounded-2xl border border-slate-200 object-cover" })) : (_jsx("div", { className: "flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-100 text-xl font-bold text-brand-purple", children: form.name.trim().slice(0, 2).toUpperCase() || 'US' })), _jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "form-label", children: "Foto do usu\u00E1rio" }), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "form-control pt-2", onChange: (e) => handleAvatarChange(e.target.files?.[0]) }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "JPG, PNG ou WebP, at\u00E9 5 MB." })] })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Nome *" }), _jsx("input", { required: true, className: "form-control", value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "E-mail *" }), _jsx("input", { required: true, type: "email", className: "form-control", value: form.email, onChange: (e) => setForm((f) => ({ ...f, email: e.target.value })) })] }), isNew && (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Senha inicial *" }), _jsx("input", { required: true, minLength: 8, type: "password", className: "form-control", value: form.password, onChange: (e) => setForm((f) => ({ ...f, password: e.target.value })) })] })), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Perfil *" }), _jsxs("select", { required: true, className: "form-control", value: form.roleId, onChange: (e) => setForm((f) => ({ ...f, roleId: e.target.value })), children: [_jsx("option", { value: "", children: "Selecione\u2026" }), roles.map((r) => (_jsx("option", { value: r.id, children: r.name }, r.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Cargo" }), _jsx("input", { className: "form-control", value: form.position ?? '', onChange: (e) => setForm((f) => ({ ...f, position: e.target.value || undefined })) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Telefone" }), _jsx(PhoneInput, { className: "form-control", value: form.phone ?? '', onValueChange: (value) => setForm((f) => ({ ...f, phone: value || undefined })) })] }), _jsxs("label", { className: "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 md:col-span-2", children: [_jsx("input", { type: "checkbox", className: "mt-1 h-4 w-4 accent-brand-purple", checked: form.mustChangePassword ?? false, onChange: (e) => setForm((f) => ({ ...f, mustChangePassword: e.target.checked })) }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-medium text-slate-700", children: "Obrigar troca de senha no pr\u00F3ximo acesso" }), _jsx("span", { className: "mt-1 block text-xs text-slate-400", children: "Ao salvar, a senha tempor\u00E1ria ser\u00E1 Senha@123. O usu\u00E1rio s\u00F3 poder\u00E1 acessar o CRM depois de definir uma nova senha." })] })] }), error && (_jsx("p", { className: "md:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-600", children: error })), _jsxs("div", { className: "flex justify-end gap-2 border-t border-slate-100 pt-4 md:col-span-2", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: onClose, children: "Cancelar" }), _jsx("button", { className: "btn-primary", disabled: saving, children: saving ? 'Salvando…' : 'Salvar usuário' })] })] }) }));
}
function RoleForm({ role, onClose, onSaved, }) {
    const isNew = role === 'new';
    const [name, setName] = useState(isNew ? '' : role.name);
    const [description, setDescription] = useState(isNew ? '' : (role.description ?? ''));
    const [error, setError] = useState(null);
    async function submit(e) {
        e.preventDefault();
        try {
            isNew
                ? await rolesApi.create({ name, description })
                : await rolesApi.update(role.id, { name, description });
            onSaved();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
        }
    }
    return (_jsx(Modal, { title: isNew ? 'Novo perfil' : 'Editar perfil', onClose: onClose, children: _jsxs("form", { onSubmit: submit, className: "space-y-4 p-5", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Nome *" }), _jsx("input", { required: true, className: "form-control", value: name, onChange: (e) => setName(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Descri\u00E7\u00E3o" }), _jsx("textarea", { className: "form-control", value: description, onChange: (e) => setDescription(e.target.value) })] }), error && _jsx("p", { className: "rounded-xl bg-red-50 p-3 text-sm text-red-600", children: error }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: onClose, children: "Cancelar" }), _jsx("button", { className: "btn-primary", children: "Salvar perfil" })] })] }) }));
}
function RoleMatrix({ role, permissions, canManage, onSaved, onEdit, onRemove, }) {
    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    useEffect(() => setSelected(role?.permissions ?? []), [role]);
    const groups = useMemo(() => permissions.reduce((a, p) => {
        var _a;
        (a[_a = p.module] ?? (a[_a] = [])).push(p);
        return a;
    }, {}), [permissions]);
    if (!role)
        return (_jsx("div", { className: "card flex min-h-80 items-center justify-center text-sm text-slate-400", children: "Selecione um perfil." }));
    const activeRole = role;
    const editable = canManage && !activeRole.isSystem;
    async function save() {
        setSaving(true);
        try {
            onSaved(await rolesApi.setPermissions(activeRole.id, selected));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "card overflow-hidden", children: [_jsxs("div", { className: "flex items-start justify-between border-b border-slate-100 p-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-bold text-slate-800", children: role.name }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: role.isSystem
                                    ? 'Perfil protegido e gerenciado pelo sistema.'
                                    : 'Selecione as ações permitidas para este perfil.' })] }), editable && (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "icon-button", onClick: () => onEdit(role), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { className: "icon-button hover:!text-red-600", onClick: () => onRemove(role), children: _jsx(Icon, { name: "trash", className: "h-4 w-4" }) })] }))] }), _jsx("div", { className: "space-y-5 p-5", children: Object.entries(groups).map(([module, items]) => (_jsxs("section", { children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("h3", { className: "text-xs font-bold uppercase tracking-wider text-slate-500", children: MODULE_LABELS[module] ?? module }), editable && (_jsx("button", { className: "text-[10px] font-bold text-brand-purple", onClick: () => {
                                        const keys = items.map((i) => i.key);
                                        setSelected((s) => keys.every((k) => s.includes(k))
                                            ? s.filter((k) => !keys.includes(k))
                                            : [...new Set([...s, ...keys])]);
                                    }, children: "Alternar m\u00F3dulo" }))] }), _jsx("div", { className: "grid gap-2 md:grid-cols-2", children: items.map((p) => (_jsxs("label", { className: `flex items-start gap-3 rounded-xl border p-3 ${selected.includes(p.key) ? 'border-purple-200 bg-purple-50/50' : 'border-slate-100'}`, children: [_jsx("input", { type: "checkbox", disabled: !editable, checked: selected.includes(p.key), onChange: (e) => setSelected((s) => e.target.checked ? [...s, p.key] : s.filter((k) => k !== p.key)), className: "mt-0.5" }), _jsxs("span", { children: [_jsx("span", { className: "block text-xs font-semibold text-slate-700", children: p.description ?? p.key }), _jsx("span", { className: "mt-0.5 block text-[10px] text-slate-400", children: p.key })] })] }, p.id))) })] }, module))) }), editable && (_jsx("div", { className: "sticky bottom-0 flex justify-end border-t border-slate-100 bg-white p-4", children: _jsx("button", { disabled: saving, className: "btn-primary", onClick: save, children: saving ? 'Salvando…' : 'Salvar permissões' }) }))] }));
}

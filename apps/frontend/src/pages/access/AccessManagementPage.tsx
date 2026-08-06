import { type FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { rolesApi, type Permission, type Role } from '../../lib/rolesApi';
import {
  avatarUrl,
  usersApi,
  type UserPayload,
  type UserRecord,
  type UsersFilters,
} from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
type Tab = 'users' | 'roles';
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MODULE_LABELS: Record<string, string> = {
  users: 'Usuários',
  roles: 'Perfis de acesso',
  settings: 'Configurações',
  leads: 'Leads e oportunidades',
  partners: 'Parceiros',
  tasks: 'Tarefas',
  dashboard: 'Dashboard',
};
function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="mobile-modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white p-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose}>
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function AccessManagementPage() {
  const current = useAuthStore((s) => s.user);
  const canManageRoles = current?.permissions.includes('roles.manage') ?? false;
  const canCreate = current?.permissions.includes('users.create') ?? false;
  const canEdit = current?.permissions.includes('users.edit') ?? false;
  const canDelete = current?.permissions.includes('users.delete') ?? false;
  const [tab, setTab] = useState<Tab>('users');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<UsersFilters>({ page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | 'new' | null>(null);
  const [editingRole, setEditingRole] = useState<Role | 'new' | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
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
  async function status(user: UserRecord) {
    try {
      await (user.status === 'ACTIVE'
        ? usersApi.deactivate(user.id)
        : usersApi.reactivate(user.id));
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar status.');
    }
  }
  async function reset(user: UserRecord) {
    const password = window.prompt(`Nova senha para ${user.name} (mínimo 8 caracteres):`);
    if (!password) return;
    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    try {
      await usersApi.resetPassword(user.id, password);
      window.alert('Senha redefinida com sucesso.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao redefinir senha.');
    }
  }
  async function removeUser(user: UserRecord) {
    const confirmed = window.confirm(
      `Excluir permanentemente o usuário "${user.name}"?\n\nEsta ação não poderá ser desfeita.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await usersApi.remove(user.id);
      loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir usuário.');
    }
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Administração"
        title="Usuários e acessos"
        description="Gerencie pessoas, perfis e permissões de toda a plataforma."
        actions={
          (tab === 'users' ? canCreate : canManageRoles) && (
            <button
              className="btn-primary"
              onClick={() => (tab === 'users' ? setEditingUser('new') : setEditingRole('new'))}
            >
              <Icon name="plus" className="h-4 w-4" />
              {tab === 'users' ? 'Novo usuário' : 'Novo perfil'}
            </button>
          )
        }
      />
      <div className="mb-5 flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          className={`rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'users' ? 'bg-brand-purple text-white' : 'text-slate-500'}`}
          onClick={() => setTab('users')}
        >
          Usuários
        </button>
        <button
          className={`rounded-xl px-5 py-2.5 text-sm font-bold ${tab === 'roles' ? 'bg-brand-purple text-white' : 'text-slate-500'}`}
          onClick={() => setTab('roles')}
        >
          Perfis e permissões
        </button>
      </div>
      {error && (
        <div className="mb-4 flex justify-between rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}
      {tab === 'users' ? (
        <>
          <div className="filter-panel">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
              <div className="relative">
                <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  className="form-control pl-10"
                  placeholder="Buscar por nome ou e-mail..."
                  value={filters.search ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 1 }))
                  }
                />
              </div>
              <select
                className="form-control"
                value={filters.roleId ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, roleId: e.target.value || undefined, page: 1 }))
                }
              >
                <option value="">Todos os perfis</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                className="form-control"
                value={filters.status ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    status: (e.target.value || undefined) as UsersFilters['status'],
                    page: 1,
                  }))
                }
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </select>
            </div>
          </div>
          <div className="table-shell overflow-x-auto">
            {loading ? (
              <p className="p-12 text-center text-sm text-slate-400">Carregando usuários…</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfil</th>
                    <th>Cargo</th>
                    <th>Telefone</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img
                              src={avatarUrl(u.id, u.avatarUrl)}
                              alt={`Foto de ${u.name}`}
                              className="h-9 w-9 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-xs font-bold text-brand-purple">
                              {u.name
                                .split(' ')
                                .slice(0, 2)
                                .map((p) => p[0])
                                .join('')
                                .toUpperCase()}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                          {u.role.name}
                        </span>
                      </td>
                      <td>{u.position || '—'}</td>
                      <td>{u.phone || '—'}</td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-2 text-xs font-bold ${u.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}
                        >
                          <span
                            className={`status-dot ${u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                          {u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <>
                              <button
                                className="icon-button"
                                title="Editar"
                                onClick={() => setEditingUser(u)}
                              >
                                <Icon name="edit" className="h-4 w-4" />
                              </button>
                              <button
                                className="icon-button"
                                title="Redefinir senha"
                                onClick={() => reset(u)}
                              >
                                <Icon name="settings" className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(canDelete || canEdit) && (
                            <button
                              disabled={u.id === current?.id}
                              className="icon-button disabled:opacity-30"
                              title={u.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                              onClick={() => status(u)}
                            >
                              <Icon
                                name={u.status === 'ACTIVE' ? 'archive' : 'view'}
                                className="h-4 w-4"
                              />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              disabled={u.id === current?.id}
                              className="icon-button hover:!bg-red-50 hover:!text-red-600 disabled:opacity-30"
                              title="Excluir permanentemente"
                              onClick={() => removeUser(u)}
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">{total} usuário(s) encontrado(s).</p>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`card w-full p-4 text-left transition ${selectedRole?.id === role.id ? 'border-brand-purple ring-2 ring-purple-100' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{role.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {role.description || 'Sem descrição'}
                    </p>
                  </div>
                  {role.isSystem && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500">
                      Sistema
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-semibold text-brand-purple">
                  {role.permissions.length} permissões
                </p>
              </button>
            ))}
          </div>
          <RoleMatrix
            role={selectedRole ?? roles[0] ?? null}
            permissions={permissions}
            canManage={canManageRoles}
            onSaved={(role) => {
              setRoles((c) => c.map((r) => (r.id === role.id ? role : r)));
              setSelectedRole(role);
            }}
            onEdit={setEditingRole}
            onRemove={async (role) => {
              if (window.confirm(`Excluir o perfil ${role.name}?`)) {
                try {
                  await rolesApi.remove(role.id);
                  setSelectedRole(null);
                  loadRoles();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erro ao excluir perfil.');
                }
              }
            }}
          />
        </div>
      )}
      {editingUser && (
        <UserForm
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}
      {editingRole && (
        <RoleForm
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            loadRoles();
          }}
        />
      )}
    </AppShell>
  );
}

function UserForm({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: UserRecord | 'new';
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = user === 'new';
  const [form, setForm] = useState<UserPayload>(
    isNew
      ? { name: '', email: '', password: '', roleId: '' }
      : {
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          position: user.position ?? undefined,
          phone: user.phone ?? undefined,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setSession = useAuthStore((state) => state.setSession);
  function handleAvatarChange(file?: File) {
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
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let saved = isNew ? await usersApi.create(form) : await usersApi.update(user.id, form);
      if (avatarFile) saved = await usersApi.uploadAvatar(saved.id, avatarFile);
      if (currentUser?.id === saved.id && accessToken) {
        setSession(accessToken, { ...currentUser, avatarUrl: saved.avatarUrl });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={isNew ? 'Novo usuário' : 'Editar usuário'}
      description="Dados pessoais e perfil de acesso."
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 p-5 md:grid-cols-2">
        <div className="flex items-center gap-4 md:col-span-2">
          {avatarFile || (!isNew && user.avatarUrl) ? (
            <img
              src={
                avatarFile
                  ? URL.createObjectURL(avatarFile)
                  : avatarUrl((user as UserRecord).id, (user as UserRecord).avatarUrl)
              }
              alt="Prévia da foto"
              className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-100 text-xl font-bold text-brand-purple">
              {form.name.trim().slice(0, 2).toUpperCase() || 'US'}
            </div>
          )}
          <div className="flex-1">
            <label className="form-label">Foto do usuário</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="form-control pt-2"
              onChange={(e) => handleAvatarChange(e.target.files?.[0])}
            />
            <p className="mt-1 text-xs text-slate-400">JPG, PNG ou WebP, até 5 MB.</p>
          </div>
        </div>
        <div>
          <label className="form-label">Nome *</label>
          <input
            required
            className="form-control"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">E-mail *</label>
          <input
            required
            type="email"
            className="form-control"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        {isNew && (
          <div>
            <label className="form-label">Senha inicial *</label>
            <input
              required
              minLength={8}
              type="password"
              className="form-control"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
        )}
        <div>
          <label className="form-label">Perfil *</label>
          <select
            required
            className="form-control"
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          >
            <option value="">Selecione…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Cargo</label>
          <input
            className="form-control"
            value={form.position ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value || undefined }))}
          />
        </div>
        <div>
          <label className="form-label">Telefone</label>
          <input
            className="form-control"
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || undefined }))}
          />
        </div>
        {error && (
          <p className="md:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 md:col-span-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RoleForm({
  role,
  onClose,
  onSaved,
}: {
  role: Role | 'new';
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = role === 'new';
  const [name, setName] = useState(isNew ? '' : role.name);
  const [description, setDescription] = useState(isNew ? '' : (role.description ?? ''));
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      isNew
        ? await rolesApi.create({ name, description })
        : await rolesApi.update(role.id, { name, description });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    }
  }
  return (
    <Modal title={isNew ? 'Novo perfil' : 'Editar perfil'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="form-label">Nome *</label>
          <input
            required
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Descrição</label>
          <textarea
            className="form-control"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary">Salvar perfil</button>
        </div>
      </form>
    </Modal>
  );
}
function RoleMatrix({
  role,
  permissions,
  canManage,
  onSaved,
  onEdit,
  onRemove,
}: {
  role: Role | null;
  permissions: Permission[];
  canManage: boolean;
  onSaved: (r: Role) => void;
  onEdit: (r: Role) => void;
  onRemove: (r: Role) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => setSelected(role?.permissions ?? []), [role]);
  const groups = useMemo(
    () =>
      permissions.reduce<Record<string, Permission[]>>((a, p) => {
        (a[p.module] ??= []).push(p);
        return a;
      }, {}),
    [permissions],
  );
  if (!role)
    return (
      <div className="card flex min-h-80 items-center justify-center text-sm text-slate-400">
        Selecione um perfil.
      </div>
    );
  const activeRole = role;
  const editable = canManage && !activeRole.isSystem;
  async function save() {
    setSaving(true);
    try {
      onSaved(await rolesApi.setPermissions(activeRole.id, selected));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-800">{role.name}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {role.isSystem
              ? 'Perfil protegido e gerenciado pelo sistema.'
              : 'Selecione as ações permitidas para este perfil.'}
          </p>
        </div>
        {editable && (
          <div className="flex gap-1">
            <button className="icon-button" onClick={() => onEdit(role)}>
              <Icon name="edit" className="h-4 w-4" />
            </button>
            <button className="icon-button hover:!text-red-600" onClick={() => onRemove(role)}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-5 p-5">
        {Object.entries(groups).map(([module, items]) => (
          <section key={module}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {MODULE_LABELS[module] ?? module}
              </h3>
              {editable && (
                <button
                  className="text-[10px] font-bold text-brand-purple"
                  onClick={() => {
                    const keys = items.map((i) => i.key);
                    setSelected((s) =>
                      keys.every((k) => s.includes(k))
                        ? s.filter((k) => !keys.includes(k))
                        : [...new Set([...s, ...keys])],
                    );
                  }}
                >
                  Alternar módulo
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${selected.includes(p.key) ? 'border-purple-200 bg-purple-50/50' : 'border-slate-100'}`}
                >
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={selected.includes(p.key)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, p.key] : s.filter((k) => k !== p.key),
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-slate-700">
                      {p.description ?? p.key}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{p.key}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      {editable && (
        <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white p-4">
          <button disabled={saving} className="btn-primary" onClick={save}>
            {saving ? 'Salvando…' : 'Salvar permissões'}
          </button>
        </div>
      )}
    </div>
  );
}

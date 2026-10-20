/** Nome do perfil de sistema com acesso administrativo (igual ao backend). */
export const ADMIN_ROLE_NAME = 'Administrador';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: { id: string; name: string };
  permissions: string[];
  /** Perfis THIRD_PARTY ficam confinados ao Portal de Terceiros (/terceiro). */
  portal?: 'INTERNAL' | 'THIRD_PARTY';
}

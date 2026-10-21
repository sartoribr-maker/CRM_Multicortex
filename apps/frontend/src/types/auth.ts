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

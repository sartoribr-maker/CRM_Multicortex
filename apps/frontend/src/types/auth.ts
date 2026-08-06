export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: { id: string; name: string };
  permissions: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: { id: string; name: string };
  permissions: string[];
}

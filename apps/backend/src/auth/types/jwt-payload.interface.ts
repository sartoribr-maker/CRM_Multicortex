export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

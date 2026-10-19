export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  /** Ausente em tokens emitidos antes do Portal SDR: tratar como INTERNAL. */
  portal?: 'INTERNAL' | 'THIRD_PARTY';
}

import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../constants/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

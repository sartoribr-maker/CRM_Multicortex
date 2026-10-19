import { SetMetadata } from '@nestjs/common';

export const ALLOW_THIRD_PARTY_PORTAL_KEY = 'allowThirdPartyPortal';

/**
 * Libera a rota para usuários de perfil THIRD_PARTY (Portal de Terceiros).
 * Sem este decorator, o ThirdPartyPortalGuard responde 403 para esses usuários.
 */
export const AllowThirdPartyPortal = () => SetMetadata(ALLOW_THIRD_PARTY_PORTAL_KEY, true);

/**
 * Tela de origem das oportunidades (lista ou Kanban), repassada em `location.state.returnTo`
 * para que formulário e detalhe devolvam o usuário ao lugar de onde ele veio.
 * Só aceita a lista e o Kanban (com filtros na query); qualquer outro valor é ignorado.
 */
export function safeLeadReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const [path] = value.split('?');
  return path === '/leads' || path === '/leads/kanban' ? value : null;
}

/** Estado de navegação que registra a tela atual como origem. */
export function returnHereState(location: { pathname: string; search: string }) {
  return { returnTo: `${location.pathname}${location.search}` };
}

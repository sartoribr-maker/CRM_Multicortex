import type { ApiHealthResponse } from '@multicortex/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api/v1';

export async function fetchHealth(): Promise<ApiHealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check falhou: ${response.status}`);
  }
  return response.json();
}

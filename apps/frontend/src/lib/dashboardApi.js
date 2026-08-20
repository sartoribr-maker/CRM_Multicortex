import { apiJson } from './api';
export const dashboardApi = { summary: () => apiJson('/dashboard/summary') };

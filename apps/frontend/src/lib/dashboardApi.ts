import{apiJson}from'./api';import type{DashboardSummary}from'../types/dashboard';export const dashboardApi={summary:()=>apiJson<DashboardSummary>('/dashboard/summary')};

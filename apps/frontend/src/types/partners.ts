import type { LeadListItem } from './leads';

export type PartnerType = 'REFERRAL' | 'TECHNOLOGY' | 'CONSULTING' | 'CHANNEL' | 'OTHER';
export type PartnerStatus = 'ACTIVE' | 'INACTIVE';
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = { REFERRAL: 'Indicador', TECHNOLOGY: 'Tecnologia', CONSULTING: 'Consultoria', CHANNEL: 'Canal comercial', OTHER: 'Outro' };
export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo' };

export interface Partner {
  id: string; name: string; legalName: string | null; type: PartnerType; document: string | null;
  contactName: string | null; email: string | null; phone: string | null; website: string | null;
  commissionPercentage: string | number | null; status: PartnerStatus; notes: string | null;
  createdAt: string; updatedAt: string; _count: { leads: number };
}
export interface PartnerDetail extends Partner { leads: Array<LeadListItem & { owner: { id: string; name: string } }> }
export interface PartnerPayload { name: string; legalName?: string; type?: PartnerType; document?: string; contactName?: string; email?: string; phone?: string; website?: string; commissionPercentage?: number; status?: PartnerStatus; notes?: string }
export interface PartnerFilters { page?: number; pageSize?: number; search?: string; type?: PartnerType; status?: PartnerStatus }
export interface PartnerListResponse { items: Partner[]; total: number; page: number; pageSize: number; totalPages: number }

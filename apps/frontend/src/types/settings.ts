export interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
  isWonStage: boolean;
  isLostStage: boolean;
  deletedAt: string | null;
}

export interface Priority {
  id: string;
  name: string;
  color: string;
  order: number;
  deletedAt: string | null;
}

export interface DealSize {
  id: string;
  name: string;
  color: string;
  order: number;
  minValue: string | number | null;
  maxValue: string | number | null;
  deletedAt: string | null;
}

export interface Source {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string | null;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string | null;
}

export interface ProjectType {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  deletedAt: string | null;
  services: Array<{ service: ServiceCatalogItem }>;
}

export type ServiceBillingUnit = 'MONTH' | 'HOUR' | 'ONE_TIME';

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  billingUnit: ServiceBillingUnit;
  // Composição do preço (planilha de precificação); "price" é o preço final com imposto.
  tier?: string | null;
  hardwareSpec?: string | null;
  priceWithoutTax?: string | number | null;
  /** Fração: 0.18 = 18%. */
  taxRate?: string | number | null;
  hardwareCost?: string | number | null;
  marginValue?: string | number | null;
  // Cobranças únicas.
  licenseCost?: string | number | null;
  setupPrivateCloudPrice?: string | number | null;
  setupOnPremisesPrice?: string | number | null;
  pocPrice?: string | number | null;
  pocDays?: number | null;
  priceReferenceDate?: string | null;
  pricingSource?: string | null;
  /** Parâmetros e notas de cada aba da planilha importada. */
  pricingParameters?: PricingTabParameters[] | null;
  deletedAt: string | null;
  _count?: { projectTypes: number };
}

export interface PricingParameter {
  group: string | null;
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'factor' | 'number';
}

export interface PricingTabParameters {
  sheet: string;
  title: string | null;
  parameters: PricingParameter[];
  notes: string[];
}

export type PricingValueField =
  | 'price'
  | 'priceWithoutTax'
  | 'hardwareCost'
  | 'marginValue'
  | 'licenseCost'
  | 'setupPrivateCloudPrice'
  | 'setupOnPremisesPrice'
  | 'pocPrice';

/** Aba da planilha de precificação, como aparece no arquivo. */
export interface PricingImportTab {
  name: string;
  title: string | null;
  columns: Array<{ field: PricingValueField; header: string }>;
  parameters: PricingParameter[];
  notes: string[];
}

/** Item da planilha de precificação no grid de importação. */
export interface PricingImportRow {
  name: string;
  tier: string | null;
  hardwareSpec: string;
  price: number | null;
  priceWithoutTax: number | null;
  hardwareCost: number | null;
  marginValue: number | null;
  licenseCost: number | null;
  setupPrivateCloudPrice: number | null;
  setupOnPremisesPrice: number | null;
  pocPrice: number | null;
  existingId: string | null;
  archived: boolean;
  invalidReason: string | null;
}

export interface PricingImportPreview {
  fileName: string;
  productName: string | null;
  referenceDate: string | null;
  taxRate: number | null;
  pocDays: number | null;
  tabs: PricingImportTab[];
  rows: PricingImportRow[];
  projectTypes: Array<{ id: string; name: string }>;
  suggestedProjectTypeId: string | null;
}

export interface PricingImportOptions {
  productName?: string;
  projectTypeId?: string;
}

export type CustomFieldType =
  'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'CURRENCY';

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  DATE: 'Data',
  SINGLE_SELECT: 'Seleção única',
  MULTI_SELECT: 'Seleção múltipla',
  BOOLEAN: 'Sim/Não',
  CURRENCY: 'Moeda',
};

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  isRequired: boolean;
  showInForm: boolean;
  showInKanbanCard: boolean;
  showInFilters: boolean;
  order: number;
  deletedAt: string | null;
}

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  hasPassword: boolean;
  updatedAt: string;
}

export interface EmailSettingsPayload {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromEmail: string;
  fromName: string;
}

export interface WhatsAppSettings {
  enabled: boolean;
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  languageCode: string;
  testTemplate: string;
  leadCreatedTemplate: string;
  leadStageTemplate: string;
  taskCreatedTemplate: string;
  taskUpdatedTemplate: string;
  testPhone: string;
  hasAccessToken: boolean;
  notifyLeadCreated: boolean;
  notifyLeadStageChanged: boolean;
  notifyTaskCreated: boolean;
  notifyTaskUpdated: boolean;
  updatedAt: string;
}
export interface WhatsAppSettingsPayload {
  enabled: boolean;
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken?: string;
  languageCode: string;
  testTemplate: string;
  leadCreatedTemplate: string;
  leadStageTemplate: string;
  taskCreatedTemplate: string;
  taskUpdatedTemplate: string;
  testPhone: string;
  notifyLeadCreated: boolean;
  notifyLeadStageChanged: boolean;
  notifyTaskCreated: boolean;
  notifyTaskUpdated: boolean;
}

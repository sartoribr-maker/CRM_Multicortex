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

export interface ProjectType {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  deletedAt: string | null;
}

export type CustomFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'
  | 'CURRENCY';

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

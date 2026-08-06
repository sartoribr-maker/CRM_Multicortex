import { apiJson } from './api';
import type {
  CustomField,
  DealSize,
  Priority,
  ProjectType,
  Segment,
  Source,
  Stage,
} from '../types/settings';

function makeCrud<T>(basePath: string) {
  return {
    list: (includeArchived = false) =>
      apiJson<T[]>(`${basePath}${includeArchived ? '?includeArchived=true' : ''}`),
    create: (payload: Partial<T>) =>
      apiJson<T>(basePath, { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      apiJson<T>(`${basePath}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    archive: (id: string) => apiJson<T>(`${basePath}/${id}/archive`, { method: 'POST' }),
  };
}

function withReorder<T>(crud: ReturnType<typeof makeCrud<T>>, basePath: string) {
  return {
    ...crud,
    reorder: (orderedIds: string[]) =>
      apiJson<T[]>(`${basePath}/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
  };
}

export const stagesApi = withReorder(makeCrud<Stage>('/stages'), '/stages');
export const prioritiesApi = withReorder(makeCrud<Priority>('/priorities'), '/priorities');
export const dealSizesApi = makeCrud<DealSize>('/deal-sizes');
export const sourcesApi = makeCrud<Source>('/sources');
export const segmentsApi = makeCrud<Segment>('/segments');
export const projectTypesApi = makeCrud<ProjectType>('/project-types');
export const customFieldsApi = makeCrud<CustomField>('/custom-fields');

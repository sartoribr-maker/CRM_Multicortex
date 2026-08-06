import { apiJson } from './api';

export interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UsersListResponse {
  items: UserOption[];
}

export const usersApi = {
  list: () => apiJson<UsersListResponse>('/users?pageSize=100').then((res) => res.items),
};

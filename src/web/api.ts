import type { User, Curation, Profile, Source } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getMe: () => request<User>('/api/user/me'),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  getCurations: () => request<Curation[]>('/api/curations'),

  updateRules: (data: { interests: string; noise: string; frequency: string }) =>
    request<User>('/api/user/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  linkProfile: (platform: string, handle: string) =>
    request<Profile>('/api/user/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handle }),
    }),

  deleteProfile: (id: string) =>
    request<{ success: boolean }>(`/api/user/profiles/${id}`, {
      method: 'DELETE',
    }),

  addSource: (type: string, value: string) =>
    request<Source>('/api/user/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value }),
    }),

  deleteSource: (id: string) =>
    request<{ success: boolean }>(`/api/user/sources/${id}`, {
      method: 'DELETE',
    }),

  rateCuration: (id: string, rating: number) =>
    request<unknown>(`/api/curations/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    }),

  triggerCuration: () =>
    request<{ success: boolean }>('/api/curations/trigger', {
      method: 'POST',
    }),

  clearHistory: () =>
    request<{ success: boolean; count: number }>('/api/curations/history', {
      method: 'DELETE',
    }),
};

/**
 * services/api.ts
 * Axios instance pre-configured with base URL and auth token injection.
 * Import this everywhere instead of raw axios.
 *
 * Usage:
 *   import { api } from '@/services/api';
 *   const { data } = await api.get('/sessions');
 */

import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('carelink_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login if token is invalid/expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('carelink_token');
      localStorage.removeItem('carelink_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────────────────────────────
// These are thin wrappers that give you typed responses.
// Expand these as you build features.

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: { id: string; username: string; role: string } }>(
      '/auth/login',
      { username, password }
    ),
};

export const patientsApi = {
  verify: (patientIdString: string) => api.get(`/patients/${patientIdString}`),
  create: (patientIdString: string) => api.post('/patients', { patientIdString }),
  list: () => api.get('/patients'),
  delete: (patientIdString: string) => api.delete(`/patients/${patientIdString}`),
};

export const sessionsApi = {
  list: () => api.get('/sessions'),
  get: (id: string) => api.get(`/sessions/${id}`),
  create: (patientIdString: string, formTemplateIds: string[]) =>
    api.post('/sessions', { patientIdString, formTemplateIds }),
  saveFields: (sessionId: string, formId: string, fields: Record<string, string>) =>
    api.patch(`/sessions/${sessionId}/forms/${formId}/fields`, { fields }),
  completeForm: (sessionId: string, formId: string) =>
    api.patch(`/sessions/${sessionId}/forms/${formId}/complete`, {}),
  recordExport: (sessionId: string, exportPath: string) =>
    api.post(`/sessions/${sessionId}/export`, { exportPath }),
  confirmMethasoft: (sessionId: string) =>
    api.post(`/sessions/${sessionId}/confirm-methasoft`, {}),
};

export const formsApi = {
  list: () => api.get('/forms'),
  get: (id: string) => api.get(`/forms/${id}`),
};

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getConfig: () => api.get('/admin/config'),
  updateConfig: (key: string, value: string) => api.patch(`/admin/config/${key}`, { value }),
  createForm: (data: unknown) => api.post('/admin/forms', data),
  updateForm: (id: string, data: unknown) => api.patch(`/admin/forms/${id}`, data),
  deleteForm: (id: string) => api.delete(`/admin/forms/${id}`),
};

export const reportsApi = {
  getWeekly: () => api.get('/reports/weekly'),
  downloadCsv: () => api.get('/reports/weekly/csv', { responseType: 'blob' }),
};

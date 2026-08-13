import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const getMe = () => api.get('/auth/me');
export const initiateGoogleAuth = () => api.get('/auth/google');
export const logout = () => api.delete('/auth/logout');
export const revokeAccount = () => api.delete('/auth/revoke');

// Analysis
export const getStorageData = () => api.get('/analysis/storage');
export const getInboxData = () => api.get('/analysis/inbox');
export const syncAnalysis = () => api.post('/analysis/sync');
export const getSenders = () => api.get('/analysis/senders');
export const getAttachments = (page = 1) => api.get(`/analysis/attachments?page=${page}`);
export const getForecast = () => api.get('/analysis/forecast');

// Cleanup
export const getCleanupCandidates = (page = 1, category?: string) => 
  api.get(`/cleanup/candidates?page=${page}${category ? `&category=${category}` : ''}`);
export const previewCleanup = (messageIds: string[]) => 
  api.post('/cleanup/preview', { messageIds });
export const executeCleanup = (messageIds: string[], action: 'delete' | 'archive' = 'delete') =>
  api.post('/cleanup/execute', { messageIds, action });
export const rollbackCleanup = (sessionId: string) => 
  api.post(`/cleanup/rollback/${sessionId}`);
export const getCleanupHistory = () => api.get('/cleanup/history');

// Subscriptions
export const getSubscriptions = () => api.get('/subscriptions');
export const unsubscribe = (email: string) => 
  api.post(`/subscriptions/${encodeURIComponent(email)}/unsubscribe`);
export const bulkUnsubscribe = (emails: string[]) =>
  api.post('/subscriptions/bulk-unsubscribe', { emails });

// Rules
export const getRules = () => api.get('/rules');
export const createRule = (data: any) => api.post('/rules', data);
export const updateRule = (id: string, data: any) => api.put(`/rules/${id}`, data);
export const deleteRule = (id: string) => api.delete(`/rules/${id}`);
export const runRule = (id: string, dryRun = true) => api.post(`/rules/${id}/run`, { dryRun });

// Insights
export const getContacts = () => api.get('/insights/contacts');
export const getWeeklyReport = () => api.get('/insights/weekly');
export const generateWeeklyReport = () => api.post('/insights/weekly/generate');
export const sendCopilotMessage = (message: string, history: any[]) =>
  api.post('/insights/copilot', { message, history });
export const getTrends = () => api.get('/insights/trends');

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data: any) => api.put('/settings', data);
export const addProtectedSender = (email: string) => api.post('/settings/protected-sender', { email });
export const removeProtectedSender = (email: string) => api.delete(`/settings/protected-sender/${encodeURIComponent(email)}`);
export const deleteAllData = () => api.delete('/settings/data');

export default api;

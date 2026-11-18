import api from './api';

export const getAiStatus = async () => (await api.get('/ai/status')).data;
export const sendAiMessage = async (payload) => (await api.post('/ai/chat', payload, { timeout: 90000 })).data;
export const getAiConversations = async () => (await api.get('/ai/conversations')).data;
export const getAiConversation = async (id) => (await api.get(`/ai/conversations/${id}`)).data;
export const deleteAiConversation = async (id) => (await api.delete(`/ai/conversations/${id}`)).data;
export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

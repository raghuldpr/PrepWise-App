import api from './api';

export const getCodingStatus = async () => (await api.get('/coding/status')).data;
export const submitCoding = async (payload) => (await api.post('/coding/submissions', payload)).data;
export const getCodingSubmissions = async (problemId) => (await api.get(`/coding/submissions/${problemId}`)).data;
export const getCodingSolution = async (problemId) => (await api.get(`/coding/solution/${problemId}`)).data;
export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

import api from './api';

export const getInterviewOptions = async () => (await api.get('/interviews/options')).data;
export const createInterview = async (payload) => (await api.post('/interviews', payload)).data;
export const getInterview = async (id) => (await api.get(`/interviews/${id}`)).data;
export const answerQuestion = async (id, payload) => (await api.post(`/interviews/${id}/answer`, payload)).data;
export const completeInterview = async (id) => (await api.post(`/interviews/${id}/complete`)).data;
export const getInterviewReport = async (id) => (await api.get(`/interviews/${id}/report`)).data;
export const getUserInterviewHistory = async () => (await api.get('/interviews/history')).data;
export const deleteInterview = async (id) => (await api.delete(`/interviews/${id}`)).data;

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

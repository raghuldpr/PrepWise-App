import api from './api';

// Analysis runs in the browser (see lib/extractText.js and @prepwise/core); the API only stores results.
export const saveAnalysis = async (payload) => (await api.post('/resume/analyses', payload)).data;
export const getUserResumes = async () => (await api.get('/resume')).data;
export const getResumeById = async (id) => (await api.get(`/resume/${id}`)).data;
export const getAnalysis = async (analysisId) => (await api.get(`/resume/analyses/${analysisId}`)).data;
export const getResumeText = async (id) => (await api.get(`/resume/${id}/text`)).data;
export const deleteResume = async (id) => (await api.delete(`/resume/${id}`)).data;

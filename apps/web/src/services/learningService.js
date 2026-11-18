import api from './api';

// Skill gap
export const analyzeSkillGap = async (payload) => (await api.post('/skills/analyze', payload)).data;
export const getLatestGapAnalysis = async () => (await api.get('/skills/gap-analysis')).data;

// Roadmap
export const generateRoadmap = async (payload) => (await api.post('/roadmap/generate', payload)).data;
export const getUserRoadmaps = async () => (await api.get('/roadmap')).data;
export const getRoadmapById = async (id) => (await api.get(`/roadmap/${id}`)).data;
export const saveRoadmapProgress = async (id, completed) => (await api.put(`/roadmap/${id}/progress`, { completed })).data;
export const deleteRoadmap = async (id) => (await api.delete(`/roadmap/${id}`)).data;

// Study plan
export const generateStudyPlan = async (payload) => (await api.post('/study-plan/generate', payload)).data;
export const getUserStudyPlans = async () => (await api.get('/study-plan')).data;
export const getStudyPlanById = async (id) => (await api.get(`/study-plan/${id}`)).data;
export const saveStudyPlanProgress = async (id, completed) => (await api.put(`/study-plan/${id}/progress`, { completed })).data;
export const deleteStudyPlan = async (id) => (await api.delete(`/study-plan/${id}`)).data;

// Projects
export const recommendProjects = async (payload) => (await api.post('/projects/recommend', payload)).data;
export const getProjectById = async (id) => (await api.get(`/projects/${id}`)).data;
export const saveProject = async (id) => (await api.post(`/projects/${id}/save`)).data;
export const unsaveProject = async (id) => (await api.delete(`/projects/${id}/save`)).data;
export const setProjectStatus = async (id, status) => (await api.put(`/projects/${id}/status`, { status })).data;
export const getSavedProjects = async () => (await api.get('/projects/saved')).data;
export const getProjectOptions = async () => (await api.get('/projects/options')).data;

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

import api from './api';

export const getSmartNext = async (moduleType) => (await api.get('/smart/next', { params: moduleType ? { moduleType } : {} })).data;
export const getSmartCurve = async () => (await api.get('/smart/curve')).data;
export const submitSmartAnswer = async (questionId, optionId, seconds) =>
  (await api.post('/attempts', { questionId, selectedAnswer: String(optionId), timeTakenSeconds: seconds })).data;
export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

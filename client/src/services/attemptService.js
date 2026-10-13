import api from './api';

export const attemptService = {
  startAttempt: async ({ joinCode, guestName }) => {
    const response = await api.post('/attempts/start', { joinCode, guestName });
    return response.data;
  },

  autosaveAttempt: async (attemptId, { answers, violation }) => {
    const response = await api.put(`/attempts/${attemptId}/autosave`, {
      answers,
      violation,
    });
    return response.data;
  },

  submitAttempt: async (attemptId, { answers, durationSeconds }) => {
    const response = await api.post(`/attempts/${attemptId}/submit`, {
      answers,
      durationSeconds,
    });
    return response.data;
  },

  getAttemptById: async (attemptId) => {
    const response = await api.get(`/attempts/${attemptId}`);
    return response.data;
  },
};

import api from './api';

export const predictionService = {
  getStudentPredictions: async () => {
    const response = await api.get('/predictions/student');
    return response.data;
  },

  getCohortInsights: async (quizId) => {
    const response = await api.get(`/predictions/cohort/${quizId}`);
    return response.data;
  },
};

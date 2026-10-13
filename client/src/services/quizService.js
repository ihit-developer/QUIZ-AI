import api from './api';

export const quizService = {
  createQuiz: async (quizData) => {
    const response = await api.post('/quizzes', quizData);
    return response.data;
  },

  getMyQuizzes: async () => {
    const response = await api.get('/quizzes/my-quizzes');
    return response.data;
  },

  getQuizByCode: async (code) => {
    const response = await api.get(`/quizzes/join/${code}`);
    return response.data;
  },

  getAvailableSelfPacedQuizzes: async () => {
    const response = await api.get('/quizzes/available');
    return response.data;
  },

  getQuizById: async (id) => {
    const response = await api.get(`/quizzes/${id}`);
    return response.data;
  },

  updateQuiz: async (id, quizData) => {
    const response = await api.put(`/quizzes/${id}`, quizData);
    return response.data;
  },

  deleteQuiz: async (id) => {
    const response = await api.delete(`/quizzes/${id}`);
    return response.data;
  },

  generateAIQuestions: async ({ topic, difficulty, count, contextText }) => {
    const response = await api.post('/quizzes/ai/generate-questions', {
      topic,
      difficulty,
      count,
      contextText,
    });
    return response.data;
  },
};

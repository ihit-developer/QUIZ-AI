import api from './api';

export const analyticsService = {
  getQuizAnalytics: async (quizId) => {
    const response = await api.get(`/analytics/${quizId}`);
    return response.data;
  },

  exportCSV: async (quizId) => {
    const response = await api.get(`/analytics/${quizId}/export/csv`, { responseType: 'blob' });
    return response.data;
  },

  downloadCertificateUrl: ({ studentName, quizTitle, percentage }) => {
    const params = new URLSearchParams({
      studentName,
      quizTitle,
      percentage: String(percentage),
    });
    return `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/analytics/export/certificate?${params.toString()}`;
  },
};

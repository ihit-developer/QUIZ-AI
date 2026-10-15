import api from './api';

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  getSessions: async () => (await api.get('/auth/sessions')).data,

  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },
  verifyEmail: async (data) => (await api.post('/auth/verify-email', data)).data,
  resendVerification: async (email) => (await api.post('/auth/resend-verification', { email })).data,
  forgotPassword: async (email) => (await api.post('/auth/forgot-password', { email })).data,
  resetPassword: async (data) => (await api.post('/auth/reset-password', data)).data,
  changePassword: async (data) => (await api.put('/auth/change-password', data)).data,
};

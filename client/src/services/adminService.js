import api from './api';

export const adminService = {
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  toggleBlockUser: async (userId) => {
    const response = await api.put(`/admin/users/${userId}/block`);
    return response.data;
  },
  updateUser: async (userId, data) => (await api.put(`/admin/users/${userId}`, data)).data,
  deleteUser: async (userId) => (await api.delete(`/admin/users/${userId}`)).data,

  getAuditLogs: async () => {
    const response = await api.get('/admin/audit-logs');
    return response.data;
  },
};

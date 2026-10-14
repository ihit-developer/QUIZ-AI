import axios from 'axios';

const isLocalDevelopment = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Local Vite (5173) and Express (5000) run on separate ports. On Vercel both
// services share one domain, so API calls must stay on the current origin.
const apiBaseUrl = import.meta.env.VITE_API_URL ||
  (isLocalDevelopment ? 'http://localhost:5000/api/v1' :
    (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:5000/api/v1'));

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('quizese_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${apiBaseUrl}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = res.data.data;
        localStorage.setItem('quizese_token', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem('quizese_token');
        localStorage.removeItem('quizese_user');
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

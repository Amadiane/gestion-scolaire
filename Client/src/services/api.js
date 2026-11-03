import axios from 'axios';
import CONFIG from '../config/config.js';
import { marquerEnLigne } from '../offline/session.js';

const api = axios.create({ baseURL: CONFIG.BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    marquerEnLigne();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = localStorage.getItem('refresh');
        const res = await axios.post(CONFIG.API_REFRESH_TOKEN, { refresh });
        localStorage.setItem('access', res.data.access);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return api(originalRequest);
      } catch (e) {
        // Réseau absent : on ne déconnecte pas, la session hors ligne reste valable.
        if (!e.response) return Promise.reject(error);
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
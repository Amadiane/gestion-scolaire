import axios from 'axios';
import CONFIG from '../config/config.js';
import { marquerEnLigne } from '../offline/session.js';
import { estMemorisable, memoriser, relire } from '../offline/cache.js';

const api = axios.create({ baseURL: CONFIG.BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    marquerEnLigne();
    if (estMemorisable(response.config)) memoriser(response.config, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Pas de réponse du serveur (réseau coupé, timeout) : on sert la copie locale si elle existe.
    if (!error.response && originalRequest && estMemorisable(originalRequest)) {
      const local = await relire(originalRequest);
      if (local?.manqueCle) {
        window.location.href = '/login';
        return Promise.reject(error);
      }
      if (local) {
        window.dispatchEvent(new CustomEvent('sylium:donnees-locales', { detail: { le: local.le } }));
        return {
          data: local.data, status: 200, statusText: 'OK', headers: {},
          config: originalRequest, request: {}, fromCache: true,
        };
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = localStorage.getItem('refresh');
        const res = await axios.post(CONFIG.API_REFRESH_TOKEN, { refresh });
        localStorage.setItem('access', res.data.access);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return api(originalRequest);
      } catch (e) {
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
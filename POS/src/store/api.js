import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// const BACKEND_URL = 'http://192.168.0.4:3001'; // Local Dev Server
const BACKEND_URL = 'https://carniwalls-pos-server.vercel.app'; // Production Server
const BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(async (cfg) => {
  try {
    const token = await AsyncStorage.getItem('rq_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.error('Error fetching token from storage', e);
  }
  return cfg;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const oldToken = await AsyncStorage.getItem('rq_token');
        if (oldToken) {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { token: oldToken });
          const newToken = data.token;
          await AsyncStorage.setItem('rq_token', newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await AsyncStorage.removeItem('rq_token');
        await AsyncStorage.removeItem('rq_user');
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export { api, BACKEND_URL, BASE };

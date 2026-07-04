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

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('rq_token');
      // Expo Router handles redirection through state changes typically,
      // we'll manage this by clearing user state in the zustand store later.
    }
    return Promise.reject(err);
  }
);

export { api, BACKEND_URL, BASE };

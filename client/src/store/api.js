import axios from 'axios'
import { io } from 'socket.io-client'

const isDev = import.meta.env.DEV
const BACKEND_URL = 'https://carniwalls-pos-server.vercel.app' // Always use production to sync with mobile
const BASE = `${BACKEND_URL}/api`
const socket = io(BACKEND_URL, {
  autoConnect: navigator.onLine
})

const api = axios.create({ baseURL: BASE })
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('rq_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('rq_token')
    window.location.href = '#/login'
  }
  return Promise.reject(err)
})

export { api, socket, BACKEND_URL, BASE }

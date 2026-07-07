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
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const oldToken = localStorage.getItem('rq_token')
        if (oldToken) {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { token: oldToken })
          const newToken = data.token
          localStorage.setItem('rq_token', newToken)
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          processQueue(null, newToken)
          return api(originalRequest)
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('rq_token')
        window.location.href = '#/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export { api, socket, BACKEND_URL, BASE }

import axios from 'axios'
import { normalizeApiError } from './errors'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login'
      }
    }
    // 统一归一化为公开错误类型（ApiError/NetworkError/TimeoutError/SeatConflictError/ConflictError）
    return Promise.reject(normalizeApiError(error))
  }
)

export default request

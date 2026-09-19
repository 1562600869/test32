import axios from 'axios'

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
    if (error.response) {
      const data = error.response.data || {}
      if (error.response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin')) {
          window.location.href = '/login'
        }
      }
      return Promise.reject({
        ...data,
        status: error.response.status,
        message: data.message || '请求失败'
      })
    }
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      return Promise.reject({
        code: 'TIMEOUT',
        message: '请求超时，请检查网络后重试',
        isTimeout: true,
        isNetworkError: true
      })
    }
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: '无法连接服务器，请检查网络后重试',
      isNetworkError: true
    })
  }
)

export default request

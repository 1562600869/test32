import request from '../utils/request'

export const getDashboardStats = () => {
  return request.get('/admin/stats')
}

export const getOrderStats = (params) => {
  return request.get('/admin/order-stats', { params })
}

export const getAllOrders = (params) => {
  return request.get('/admin/orders', { params })
}

export const getAllUsers = () => {
  return request.get('/admin/users')
}

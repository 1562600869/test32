import request from '../utils/request'

export const getOrders = (params) => {
  return request.get('/orders', { params })
}

export const getOrderDetail = (orderNo) => {
  return request.get(`/orders/${orderNo}`)
}

export const createOrder = (data) => {
  return request.post('/orders', data)
}

export const payOrder = (orderNo) => {
  return request.post(`/orders/${orderNo}/pay`)
}

export const cancelOrder = (orderNo) => {
  return request.post(`/orders/${orderNo}/cancel`)
}

import request from '../utils/request'

export const getShowtimes = (params) => {
  return request.get('/showtimes', { params })
}

export const getShowtimeById = (id) => {
  return request.get(`/showtimes/${id}`)
}

export const createShowtime = (data) => {
  return request.post('/showtimes', data)
}

export const updateShowtime = (id, data) => {
  return request.put(`/showtimes/${id}`, data)
}

export const deleteShowtime = (id) => {
  return request.delete(`/showtimes/${id}`)
}

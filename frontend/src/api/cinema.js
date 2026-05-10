import request from '../utils/request'

export const getCinemas = () => {
  return request.get('/cinemas')
}

export const getHallsByCinema = (cinemaId) => {
  return request.get(`/cinemas/${cinemaId}/halls`)
}

export const getHallById = (id) => {
  return request.get(`/cinemas/halls/${id}`)
}

export const createCinema = (data) => {
  return request.post('/cinemas', data)
}

export const createHall = (data) => {
  return request.post('/cinemas/halls', data)
}

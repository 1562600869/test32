import request from '../utils/request'

export const getMovies = (params) => {
  return request.get('/movies', { params })
}

export const getMovieById = (id) => {
  return request.get(`/movies/${id}`)
}

export const createMovie = (data) => {
  return request.post('/movies', data)
}

export const updateMovie = (id, data) => {
  return request.put(`/movies/${id}`, data)
}

export const deleteMovie = (id) => {
  return request.delete(`/movies/${id}`)
}

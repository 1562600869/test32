const express = require('express');
const { getMovies, getMovieById, createMovie, updateMovie, deleteMovie } = require('../controllers/movieController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', getMovies);
router.get('/:id', getMovieById);

router.post('/', authenticate, requireAdmin, createMovie);
router.put('/:id', authenticate, requireAdmin, updateMovie);
router.delete('/:id', authenticate, requireAdmin, deleteMovie);

module.exports = router;

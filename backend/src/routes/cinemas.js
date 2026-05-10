const express = require('express');
const { 
  getCinemas, getCinemaById, createCinema, updateCinema, deleteCinema,
  getHallsByCinema, createHall, getHallById
} = require('../controllers/cinemaController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', getCinemas);
router.get('/:id', getCinemaById);
router.get('/:cinemaId/halls', getHallsByCinema);
router.get('/halls/:id', getHallById);

router.post('/', authenticate, requireAdmin, createCinema);
router.put('/:id', authenticate, requireAdmin, updateCinema);
router.delete('/:id', authenticate, requireAdmin, deleteCinema);
router.post('/halls', authenticate, requireAdmin, createHall);

module.exports = router;

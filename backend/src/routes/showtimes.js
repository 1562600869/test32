const express = require('express');
const { getShowtimes, getShowtimeById, createShowtime, updateShowtime, deleteShowtime } = require('../controllers/showtimeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', getShowtimes);
router.get('/:id', getShowtimeById);

router.post('/', authenticate, requireAdmin, createShowtime);
router.put('/:id', authenticate, requireAdmin, updateShowtime);
router.delete('/:id', authenticate, requireAdmin, deleteShowtime);

module.exports = router;

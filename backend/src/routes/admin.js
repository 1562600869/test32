const express = require('express');
const { getDashboardStats, getOrderStats, getAllOrders, getAllUsers } = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/stats', getDashboardStats);
router.get('/order-stats', getOrderStats);
router.get('/orders', getAllOrders);
router.get('/users', getAllUsers);

module.exports = router;

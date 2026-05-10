const express = require('express');
const { createOrder, payOrder, cancelOrder, getOrders, getOrderDetail } = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getOrders);
router.get('/:order_no', authenticate, getOrderDetail);
router.post('/', authenticate, createOrder);
router.post('/:order_no/pay', authenticate, payOrder);
router.post('/:order_no/cancel', authenticate, cancelOrder);

module.exports = router;

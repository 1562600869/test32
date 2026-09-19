const pool = require('../database');
const { generateOrderNo } = require('../utils/orderNo');
const { LOCK_TTL_MS } = require('../config');
const { SeatConflictError, OrderStateError } = require('../errors');

// 订单状态机：pending(已锁定) -> paid / expired / cancelled
// - 锁定带 TTL（LOCK_TTL_MINUTES，默认 15 分钟），过期自动释放座位
// - 支付幂等：重复支付同一已支付订单返回相同成功结果，不产生第二笔票

const formatDateTime = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const createOrder = async (req, res, next) => {
  const { showtime_id, seat_ids } = req.body;
  const userId = req.user.id;

  if (!showtime_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ message: '请选择座位', code: 'INVALID_SEAT_SELECTION' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [showtimes] = await connection.query(
      'SELECT * FROM showtimes WHERE id = ?',
      [showtime_id]
    );

    if (showtimes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '场次不存在', code: 'SHOWTIME_NOT_FOUND' });
    }

    const showtime = showtimes[0];

    const placeholders = seat_ids.map(() => '?').join(',');
    const [seats] = await connection.query(
      `SELECT sl.*,
              CASE WHEN os.id IS NOT NULL THEN true ELSE false END as is_sold
       FROM seat_layouts sl
       LEFT JOIN order_seats os ON sl.id = os.seat_id AND os.showtime_id = ? AND os.status IN ('reserved', 'sold')
       WHERE sl.id IN (${placeholders})`,
      [showtime_id, ...seat_ids]
    );

    if (seats.length !== seat_ids.length) {
      await connection.rollback();
      return res.status(400).json({ message: '存在无效座位', code: 'INVALID_SEAT_SELECTION' });
    }

    const unavailableSeats = seats.filter((s) => s.is_sold);
    if (unavailableSeats.length > 0) {
      await connection.rollback();
      throw new SeatConflictError(
        showtime_id,
        unavailableSeats.map((s) => ({ row: s.row_number, col: s.col_number }))
      );
    }

    const totalAmount = showtime.ticket_price * seat_ids.length;
    const orderNo = generateOrderNo();
    const expiresAt = formatDateTime(new Date(Date.now() + LOCK_TTL_MS));

    const [orderResult] = await connection.query(
      'INSERT INTO orders (order_no, user_id, showtime_id, total_amount, status, version, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderNo, userId, showtime_id, totalAmount, 'pending', 0, expiresAt]
    );

    const orderId = orderResult.insertId;
    const orderSeatValues = seat_ids.map((seatId) => [orderId, showtime_id, seatId, 'reserved', 0]);

    try {
      // unique_showtime_seat(showtime_id, seat_id, status) 保证并发下最多一人锁定成功
      await connection.query(
        'INSERT INTO order_seats (order_id, showtime_id, seat_id, status, version) VALUES ?',
        [orderSeatValues]
      );
    } catch (insertError) {
      await connection.rollback();
      if (insertError.code === 'ER_DUP_ENTRY') {
        throw new SeatConflictError(
          showtime_id,
          seats.map((s) => ({ row: s.row_number, col: s.col_number }))
        );
      }
      throw insertError;
    }

    await connection.commit();

    res.status(201).json({
      message: '订单创建成功',
      order: {
        id: orderId,
        order_no: orderNo,
        total_amount: totalAmount,
        status: 'pending',
        expires_at: expiresAt,
        seats: seats.map((s) => ({
          id: s.id,
          row: s.row_number,
          col: s.col_number,
          seat_type: s.seat_type
        }))
      }
    });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* already rolled back */ }
    next(error);
  } finally {
    connection.release();
  }
};

const payOrder = async (req, res, next) => {
  const { order_no } = req.params;
  const userId = req.user.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_no = ? AND user_id = ? FOR UPDATE',
      [order_no, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '订单不存在', code: 'ORDER_NOT_FOUND' });
    }

    const order = orders[0];

    // 幂等：重复支付已支付订单直接返回成功，不生成第二笔票
    if (order.status === 'paid') {
      await connection.commit();
      return res.json({ message: '支付成功', order_no, already_paid: true });
    }

    if (order.status !== 'pending') {
      await connection.rollback();
      throw new OrderStateError(order_no, order.status, 'pay');
    }

    const expired =
      (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) ||
      Date.now() - new Date(order.created_at).getTime() > LOCK_TTL_MS;

    if (expired) {
      await connection.query(
        "UPDATE orders SET status = 'expired', version = version + 1 WHERE id = ? AND status = 'pending'",
        [order.id]
      );
      await connection.query(
        "UPDATE order_seats SET status = 'cancelled', version = version + 1 WHERE order_id = ? AND status = 'reserved'",
        [order.id]
      );
      await connection.commit();
      throw new OrderStateError(order_no, 'expired', 'pay');
    }

    const [updateResult] = await connection.query(
      "UPDATE orders SET status = 'paid', paid_at = NOW(), version = version + 1 WHERE id = ? AND status = 'pending' AND version = ?",
      [order.id, order.version]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      throw new OrderStateError(order_no, order.status, 'pay');
    }

    await connection.query(
      "UPDATE order_seats SET status = 'sold', version = version + 1 WHERE order_id = ? AND status = 'reserved'",
      [order.id]
    );

    await connection.commit();

    res.json({ message: '支付成功', order_no });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* already rolled back */ }
    next(error);
  } finally {
    connection.release();
  }
};

const cancelOrder = async (req, res, next) => {
  const { order_no } = req.params;
  const userId = req.user.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_no = ? AND user_id = ? FOR UPDATE',
      [order_no, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '订单不存在', code: 'ORDER_NOT_FOUND' });
    }

    const order = orders[0];

    // 幂等：重复取消返回成功
    if (order.status === 'cancelled') {
      await connection.commit();
      return res.json({ message: '订单取消成功', already_cancelled: true });
    }

    if (order.status !== 'pending' && order.status !== 'paid') {
      await connection.rollback();
      throw new OrderStateError(order_no, order.status, 'cancel');
    }

    const [updateResult] = await connection.query(
      'UPDATE orders SET status = ?, version = version + 1 WHERE id = ? AND version = ?',
      ['cancelled', order.id, order.version]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      throw new OrderStateError(order_no, order.status, 'cancel');
    }

    await connection.query(
      "UPDATE order_seats SET status = 'cancelled', version = version + 1 WHERE order_id = ? AND status IN ('reserved', 'sold')",
      [order.id]
    );

    await connection.commit();

    res.json({ message: '订单取消成功' });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* already rolled back */ }
    next(error);
  } finally {
    connection.release();
  }
};

const getOrders = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  let query = `
    SELECT o.*, m.title as movie_title, m.poster, s.start_time, s.end_time, 
           h.name as hall_name, c.name as cinema_name
    FROM orders o
    JOIN showtimes s ON o.showtime_id = s.id
    JOIN movies m ON s.movie_id = m.id
    JOIN halls h ON s.hall_id = h.id
    JOIN cinemas c ON h.cinema_id = c.id
    WHERE o.user_id = ?
  `;
  const params = [userId];

  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }

  query += ' ORDER BY o.created_at DESC';

  try {
    const [orders] = await pool.query(query, params);
    res.json({ orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
};

const getOrderDetail = async (req, res) => {
  const { order_no } = req.params;
  const userId = req.user.id;

  try {
    const [orders] = await pool.query(`
      SELECT o.*, m.title as movie_title, m.poster, m.duration, s.start_time, s.end_time, 
             s.ticket_price, h.name as hall_name, c.name as cinema_name, c.location
      FROM orders o
      JOIN showtimes s ON o.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN halls h ON s.hall_id = h.id
      JOIN cinemas c ON h.cinema_id = c.id
      WHERE o.order_no = ? AND o.user_id = ?
    `, [order_no, userId]);

    if (orders.length === 0) {
      return res.status(404).json({ message: '订单不存在', code: 'ORDER_NOT_FOUND' });
    }

    const order = orders[0];
    const [seats] = await pool.query(`
      SELECT sl.*
      FROM order_seats os
      JOIN seat_layouts sl ON os.seat_id = sl.id
      WHERE os.order_id = ?
    `, [order.id]);

    res.json({ order, seats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
};

module.exports = { createOrder, payOrder, cancelOrder, getOrders, getOrderDetail };

const pool = require('../database');
const { generateOrderNo } = require('../utils/orderNo');

const LOCK_TTL_MINUTES = 15;

const findConflictSeats = async (connection, showtimeId, seatIds) => {
  const placeholders = seatIds.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT sl.id AS seat_id, sl.row_number AS row, sl.col_number AS col, os.status AS held_status
     FROM seat_layouts sl
     JOIN order_seats os ON os.seat_id = sl.id AND os.showtime_id = ? AND os.status IN ('reserved', 'sold')
     WHERE sl.id IN (${placeholders})`,
    [showtimeId, ...seatIds]
  );
  return rows;
};

const seatConflictResponse = (res, showtimeId, conflictSeats) => {
  return res.status(409).json({
    code: 'SEAT_CONFLICT',
    message: `场次 ${showtimeId} 的部分座位已被其他用户锁定或售出：${
      conflictSeats.map(s => `${s.row}排${s.col}座`).join('、')
    }`,
    showtime_id: showtimeId,
    conflict_seats: conflictSeats.map(s => ({
      seat_id: s.seat_id,
      row: s.row,
      col: s.col,
      held_status: s.held_status
    }))
  });
};

const createOrder = async (req, res) => {
  const { showtime_id, seat_ids } = req.body;
  const userId = req.user.id;

  if (!showtime_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ message: '请选择座位' });
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
      return res.status(404).json({ message: '场次不存在' });
    }

    const showtime = showtimes[0];

    const placeholders = seat_ids.map(() => '?').join(',');
    const [seats] = await connection.query(
      `SELECT sl.*, 
              CASE WHEN os.id IS NOT NULL AND os.status IN ('reserved', 'sold') THEN true ELSE false END as is_sold
       FROM seat_layouts sl
       LEFT JOIN order_seats os ON sl.id = os.seat_id AND os.showtime_id = ? AND os.status IN ('reserved', 'sold')
       WHERE sl.id IN (${placeholders})`,
      [showtime_id, ...seat_ids]
    );

    if (seats.length !== seat_ids.length) {
      await connection.rollback();
      return res.status(400).json({ message: '存在无效座位' });
    }

    const unavailableSeats = seats.filter(s => s.is_sold);
    if (unavailableSeats.length > 0) {
      const conflictSeats = await findConflictSeats(connection, showtime_id, seat_ids);
      await connection.rollback();
      return seatConflictResponse(res, showtime_id, conflictSeats);
    }

    const totalAmount = showtime.ticket_price * seat_ids.length;
    const orderNo = generateOrderNo();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_no, user_id, showtime_id, total_amount, status, version, expires_at)
       VALUES (?, ?, ?, ?, 'pending', 0, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [orderNo, userId, showtime_id, totalAmount, LOCK_TTL_MINUTES]
    );

    const orderId = orderResult.insertId;
    const orderSeatValues = seat_ids.map(seatId => [orderId, showtime_id, seatId, 'reserved', 0]);

    await connection.query(
      'INSERT INTO order_seats (order_id, showtime_id, seat_id, status, version) VALUES ?',
      [orderSeatValues]
    );

    await connection.commit();

    res.status(201).json({
      message: '订单创建成功',
      order: {
        id: orderId,
        order_no: orderNo,
        total_amount: totalAmount,
        status: 'pending',
        lock_ttl_minutes: LOCK_TTL_MINUTES,
        seats: seats.map(s => ({
          id: s.id,
          row: s.row_number,
          col: s.col_number,
          seat_type: s.seat_type
        }))
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      try {
        const conflictSeats = await findConflictSeats(pool, showtime_id, seat_ids);
        return seatConflictResponse(res, showtime_id, conflictSeats);
      } catch (lookupError) {
        console.error(lookupError);
        return res.status(409).json({
          code: 'SEAT_CONFLICT',
          message: `场次 ${showtime_id} 的座位已被其他用户锁定，请重新选择`,
          showtime_id,
          conflict_seats: []
        });
      }
    }
    
    res.status(500).json({ message: '服务器内部错误' });
  } finally {
    connection.release();
  }
};

const payOrder = async (req, res) => {
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
      return res.status(404).json({ message: '订单不存在' });
    }

    const order = orders[0];

    if (order.status === 'paid') {
      await connection.commit();
      return res.json({
        message: '订单已支付，请勿重复操作',
        order_no,
        already_paid: true
      });
    }

    if (order.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        code: 'ORDER_NOT_PAYABLE',
        message: `订单状态为 ${order.status}，不允许支付`,
        order_status: order.status
      });
    }

    const currentTime = new Date();
    const expiresAt = order.expires_at
      ? new Date(order.expires_at)
      : new Date(new Date(order.created_at).getTime() + LOCK_TTL_MINUTES * 60 * 1000);

    if (currentTime > expiresAt) {
      await connection.query(
        `UPDATE orders SET status = 'expired', version = version + 1 WHERE id = ? AND status = 'pending'`,
        [order.id]
      );
      await connection.query(
        `UPDATE order_seats SET status = 'expired', version = version + 1 WHERE order_id = ? AND status = 'reserved'`,
        [order.id]
      );
      await connection.commit();
      return res.status(400).json({
        code: 'ORDER_EXPIRED',
        message: '订单已超时，座位锁定已释放，请重新下单',
        order_status: 'expired'
      });
    }

    const [updateResult] = await connection.query(
      `UPDATE orders SET status = 'paid', paid_at = NOW(), version = version + 1 WHERE id = ? AND status = 'pending'`,
      [order.id]
    );

    if (updateResult.affectedRows === 0) {
      const [fresh] = await connection.query('SELECT status FROM orders WHERE id = ?', [order.id]);
      if (fresh.length > 0 && fresh[0].status === 'paid') {
        await connection.commit();
        return res.json({
          message: '订单已支付，请勿重复操作',
          order_no,
          already_paid: true
        });
      }
      await connection.rollback();
      return res.status(409).json({
        code: 'ORDER_STATE_CONFLICT',
        message: '订单已被其他操作处理，请刷新后重试'
      });
    }

    const [seatUpdateResult] = await connection.query(
      'UPDATE order_seats SET status = ?, version = version + 1 WHERE order_id = ? AND status = ?',
      ['sold', order.id, 'reserved']
    );

    if (seatUpdateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '座位状态异常，请联系客服' });
    }

    await connection.commit();

    res.json({ message: '支付成功', order_no });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  } finally {
    connection.release();
  }
};

const cancelOrder = async (req, res) => {
  const { order_no } = req.params;
  const userId = req.user.id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_no = ? AND user_id = ?',
      [order_no, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '订单不存在' });
    }

    const order = orders[0];

    if (order.status !== 'pending' && order.status !== 'paid') {
      await connection.rollback();
      return res.status(400).json({ message: '当前订单状态无法取消' });
    }

    const [updateResult] = await connection.query(
      'UPDATE orders SET status = ?, version = version + 1 WHERE id = ? AND version = ?',
      ['cancelled', order.id, order.version]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '订单已被其他操作处理，请重试' });
    }

    await connection.query(
      'UPDATE order_seats SET status = ?, version = version + 1 WHERE order_id = ?',
      ['cancelled', order.id]
    );

    await connection.commit();

    res.json({ message: '订单取消成功' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
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
    res.status(500).json({ message: '服务器内部错误' });
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
      return res.status(404).json({ message: '订单不存在' });
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
    res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = { createOrder, payOrder, cancelOrder, getOrders, getOrderDetail };

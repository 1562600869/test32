const pool = require('../database');
const { ShowtimeLayoutLockedError } = require('../errors');

const getShowtimes = async (req, res) => {
  const { movie_id, date } = req.query;
  let query = `
    SELECT s.*, m.title as movie_title, m.poster, h.name as hall_name, c.name as cinema_name
    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN halls h ON s.hall_id = h.id
    JOIN cinemas c ON h.cinema_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (movie_id) {
    query += ' AND s.movie_id = ?';
    params.push(movie_id);
  }

  if (date) {
    query += ' AND DATE(s.start_time) = ?';
    params.push(date);
  }

  query += ' ORDER BY s.start_time';

  try {
    const [showtimes] = await pool.query(query, params);
    res.json({ showtimes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
};

const getShowtimeById = async (req, res) => {
  const { id } = req.params;

  try {
    const [showtimes] = await pool.query(`
      SELECT s.*, m.title as movie_title, m.poster, m.duration, h.name as hall_name, 
             h.rows_count, h.cols_count, c.name as cinema_name
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN halls h ON s.hall_id = h.id
      JOIN cinemas c ON h.cinema_id = c.id
      WHERE s.id = ?
    `, [id]);

    if (showtimes.length === 0) {
      return res.status(404).json({ message: '场次不存在', code: 'SHOWTIME_NOT_FOUND' });
    }

    const showtime = showtimes[0];
    // 惰性过期：reserved 座位仅在其订单未过期时视为占用；
    // 已过期但尚未被定时任务清扫的锁定不会把座位永久占死（崩溃恢复语义）。
    const [seats] = await pool.query(`
      SELECT sl.*, 
             CASE 
               WHEN os.status = 'sold' THEN true
               WHEN os.status = 'reserved' AND o.status = 'pending'
                    AND (o.expires_at IS NULL OR o.expires_at > NOW()) THEN true
               ELSE false
             END as is_sold,
             CASE 
               WHEN os.status = 'sold' THEN 'sold'
               WHEN os.status = 'reserved' AND o.status = 'pending'
                    AND (o.expires_at IS NULL OR o.expires_at > NOW()) THEN 'locked'
               ELSE NULL
             END as seat_status
      FROM seat_layouts sl
      LEFT JOIN order_seats os ON sl.id = os.seat_id AND os.showtime_id = ? AND os.status IN ('reserved', 'sold')
      LEFT JOIN orders o ON os.order_id = o.id
      WHERE sl.hall_id = ? AND sl.is_active = TRUE
      ORDER BY sl.row_number, sl.col_number
    `, [id, showtime.hall_id]);

    res.json({ showtime, seats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
};

const createShowtime = async (req, res) => {
  const { movie_id, hall_id, start_time, end_time, ticket_price } = req.body;

  if (!movie_id || !hall_id || !start_time || !end_time || !ticket_price) {
    return res.status(400).json({ message: '必填字段不能为空', code: 'VALIDATION_ERROR' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO showtimes (movie_id, hall_id, start_time, end_time, ticket_price) VALUES (?, ?, ?, ?, ?)',
      [movie_id, hall_id, start_time, end_time, ticket_price]
    );

    res.status(201).json({
      message: '场次创建成功',
      showtime: {
        id: result.insertId,
        movie_id,
        hall_id,
        start_time,
        end_time,
        ticket_price
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
  }
};

// 场次存在被锁定(reserved)或已售(sold)座位时返回 true
const hasActiveSeats = async (connection, showtimeId) => {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM order_seats 
     WHERE showtime_id = ? AND status IN ('reserved', 'sold')`,
    [showtimeId]
  );
  return rows[0].cnt > 0;
};

const updateShowtime = async (req, res, next) => {
  const { id } = req.params;
  const { movie_id, hall_id, start_time, end_time, ticket_price } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      'SELECT * FROM showtimes WHERE id = ? FOR UPDATE',
      [id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '场次不存在', code: 'SHOWTIME_NOT_FOUND' });
    }

    // 影厅变更 = 座位布局变更；存在锁定/已售座位时禁止覆盖
    const layoutChanged = Number(hall_id) !== Number(existing[0].hall_id);
    if (layoutChanged && (await hasActiveSeats(connection, id))) {
      await connection.rollback();
      throw new ShowtimeLayoutLockedError(Number(id));
    }

    const [result] = await connection.query(
      'UPDATE showtimes SET movie_id = ?, hall_id = ?, start_time = ?, end_time = ?, ticket_price = ? WHERE id = ?',
      [movie_id, hall_id, start_time, end_time, ticket_price, id]
    );

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '场次不存在', code: 'SHOWTIME_NOT_FOUND' });
    }

    res.json({ message: '场次更新成功' });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* already rolled back */ }
    next(error);
  } finally {
    connection.release();
  }
};

const deleteShowtime = async (req, res, next) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (await hasActiveSeats(connection, id)) {
      await connection.rollback();
      throw new ShowtimeLayoutLockedError(Number(id));
    }

    const [result] = await connection.query('DELETE FROM showtimes WHERE id = ?', [id]);

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '场次不存在', code: 'SHOWTIME_NOT_FOUND' });
    }

    res.json({ message: '场次删除成功' });
  } catch (error) {
    try { await connection.rollback(); } catch (e) { /* already rolled back */ }
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = { getShowtimes, getShowtimeById, createShowtime, updateShowtime, deleteShowtime };

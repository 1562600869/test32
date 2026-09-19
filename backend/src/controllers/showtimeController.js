const pool = require('../database');

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
    res.status(500).json({ message: '服务器内部错误' });
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
      return res.status(404).json({ message: '场次不存在' });
    }

    const showtime = showtimes[0];
    const [seats] = await pool.query(`
      SELECT sl.*, 
             CASE WHEN os.id IS NOT NULL AND os.status IN ('reserved', 'sold') THEN true ELSE false END as is_sold,
             os.status as seat_status,
             os.order_id
      FROM seat_layouts sl
      LEFT JOIN order_seats os ON sl.id = os.seat_id AND os.showtime_id = ? AND os.status IN ('reserved', 'sold')
      WHERE sl.hall_id = ? AND sl.is_active = TRUE
      ORDER BY sl.row_number, sl.col_number
    `, [id, showtime.hall_id]);

    res.json({ showtime, seats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const createShowtime = async (req, res) => {
  const { movie_id, hall_id, start_time, end_time, ticket_price } = req.body;

  if (!movie_id || !hall_id || !start_time || !end_time || !ticket_price) {
    return res.status(400).json({ message: '必填字段不能为空' });
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
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const updateShowtime = async (req, res) => {
  const { id } = req.params;
  const { movie_id, hall_id, start_time, end_time, ticket_price } = req.body;

  try {
    const [existing] = await pool.query('SELECT * FROM showtimes WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: '场次不存在' });
    }

    // 更换影厅等于覆盖座位布局：若该场次存在被锁定(reserved)或已售(sold)的座位则拒绝
    if (Number(hall_id) !== Number(existing[0].hall_id)) {
      const [heldSeats] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM order_seats WHERE showtime_id = ? AND status IN ('reserved', 'sold')`,
        [id]
      );
      if (heldSeats[0].cnt > 0) {
        return res.status(409).json({
          code: 'SHOWTIME_SEATS_HELD',
          message: `场次 ${id} 存在被锁定或已售的座位，不能更换影厅/座位布局`,
          showtime_id: Number(id),
          held_seat_count: heldSeats[0].cnt
        });
      }
    }

    const [result] = await pool.query(
      'UPDATE showtimes SET movie_id = ?, hall_id = ?, start_time = ?, end_time = ?, ticket_price = ? WHERE id = ?',
      [movie_id, hall_id, start_time, end_time, ticket_price, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '场次不存在' });
    }

    res.json({ message: '场次更新成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const deleteShowtime = async (req, res) => {
  const { id } = req.params;

  try {
    const [heldSeats] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM order_seats WHERE showtime_id = ? AND status IN ('reserved', 'sold')`,
      [id]
    );
    if (heldSeats[0].cnt > 0) {
      return res.status(409).json({
        code: 'SHOWTIME_SEATS_HELD',
        message: `场次 ${id} 存在被锁定或已售的座位，不能删除`,
        showtime_id: Number(id),
        held_seat_count: heldSeats[0].cnt
      });
    }

    const [result] = await pool.query('DELETE FROM showtimes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '场次不存在' });
    }

    res.json({ message: '场次删除成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = { getShowtimes, getShowtimeById, createShowtime, updateShowtime, deleteShowtime };

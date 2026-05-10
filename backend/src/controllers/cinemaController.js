const pool = require('../database');

const getCinemas = async (req, res) => {
  try {
    const [cinemas] = await pool.query('SELECT * FROM cinemas ORDER BY created_at DESC');
    res.json({ cinemas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getCinemaById = async (req, res) => {
  const { id } = req.params;

  try {
    const [cinemas] = await pool.query('SELECT * FROM cinemas WHERE id = ?', [id]);

    if (cinemas.length === 0) {
      return res.status(404).json({ message: '影院不存在' });
    }

    res.json({ cinema: cinemas[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const createCinema = async (req, res) => {
  const { name, location } = req.body;

  if (!name || !location) {
    return res.status(400).json({ message: '必填字段不能为空' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO cinemas (name, location) VALUES (?, ?)',
      [name, location]
    );

    res.status(201).json({
      message: '影院创建成功',
      cinema: {
        id: result.insertId,
        name,
        location
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const updateCinema = async (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE cinemas SET name = ?, location = ? WHERE id = ?',
      [name, location, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '影院不存在' });
    }

    res.json({ message: '影院更新成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const deleteCinema = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM cinemas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '影院不存在' });
    }

    res.json({ message: '影院删除成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getHallsByCinema = async (req, res) => {
  const { cinemaId } = req.params;

  try {
    const [halls] = await pool.query('SELECT * FROM halls WHERE cinema_id = ? ORDER BY id', [cinemaId]);
    res.json({ halls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const createHall = async (req, res) => {
  const { cinema_id, name, rows_count, cols_count } = req.body;

  if (!cinema_id || !name || !rows_count || !cols_count) {
    return res.status(400).json({ message: '必填字段不能为空' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [hallResult] = await connection.query(
      'INSERT INTO halls (cinema_id, name, rows_count, cols_count) VALUES (?, ?, ?, ?)',
      [cinema_id, name, rows_count, cols_count]
    );

    const hallId = hallResult.insertId;
    const seatValues = [];
    
    for (let row = 1; row <= rows_count; row++) {
      for (let col = 1; col <= cols_count; col++) {
        const isVip = row <= 2;
        seatValues.push([hallId, row, col, isVip ? 'vip' : 'normal', true]);
      }
    }

    await connection.query(
      'INSERT INTO seat_layouts (hall_id, row_number, col_number, seat_type, is_active) VALUES ?',
      [seatValues]
    );

    await connection.commit();

    res.status(201).json({
      message: '影厅创建成功',
      hall: {
        id: hallId,
        cinema_id,
        name,
        rows_count,
        cols_count
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  } finally {
    connection.release();
  }
};

const getHallById = async (req, res) => {
  const { id } = req.params;

  try {
    const [halls] = await pool.query('SELECT * FROM halls WHERE id = ?', [id]);

    if (halls.length === 0) {
      return res.status(404).json({ message: '影厅不存在' });
    }

    const [seats] = await pool.query(
      'SELECT * FROM seat_layouts WHERE hall_id = ? ORDER BY row_number, col_number',
      [id]
    );

    res.json({ hall: halls[0], seats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = {
  getCinemas,
  getCinemaById,
  createCinema,
  updateCinema,
  deleteCinema,
  getHallsByCinema,
  createHall,
  getHallById
};

const pool = require('../database');

const getMovies = async (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM movies WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const [movies] = await pool.query(query, params);
    res.json({ movies });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getMovieById = async (req, res) => {
  const { id } = req.params;

  try {
    const [movies] = await pool.query('SELECT * FROM movies WHERE id = ?', [id]);

    if (movies.length === 0) {
      return res.status(404).json({ message: '电影不存在' });
    }

    res.json({ movie: movies[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const createMovie = async (req, res) => {
  const { title, poster, description, duration, genre, release_date, rating, status } = req.body;

  if (!title || !poster || !description || !duration || !genre || !release_date) {
    return res.status(400).json({ message: '必填字段不能为空' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO movies (title, poster, description, duration, genre, release_date, rating, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, poster, description, duration, genre, release_date, rating || 0, status || 'showing']
    );

    res.status(201).json({
      message: '电影创建成功',
      movie: {
        id: result.insertId,
        title,
        poster,
        description,
        duration,
        genre,
        release_date,
        rating: rating || 0,
        status: status || 'showing'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const updateMovie = async (req, res) => {
  const { id } = req.params;
  const { title, poster, description, duration, genre, release_date, rating, status } = req.body;

  try {
    const [movies] = await pool.query('SELECT * FROM movies WHERE id = ?', [id]);
    
    if (movies.length === 0) {
      return res.status(404).json({ message: '电影不存在' });
    }

    const movie = movies[0];
    const [result] = await pool.query(
      'UPDATE movies SET title = ?, poster = ?, description = ?, duration = ?, genre = ?, release_date = ?, rating = ?, status = ? WHERE id = ?',
      [
        title || movie.title,
        poster || movie.poster,
        description || movie.description,
        duration || movie.duration,
        genre || movie.genre,
        release_date || movie.release_date,
        rating !== undefined ? rating : movie.rating,
        status || movie.status,
        id
      ]
    );

    res.json({ message: '电影更新成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const deleteMovie = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM movies WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '电影不存在' });
    }

    res.json({ message: '电影删除成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = { getMovies, getMovieById, createMovie, updateMovie, deleteMovie };

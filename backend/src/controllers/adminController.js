const pool = require('../database');

const getDashboardStats = async (req, res) => {
  try {
    const [totalOrders] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [totalRevenue] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = "paid"');
    const [totalMovies] = await pool.query('SELECT COUNT(*) as count FROM movies WHERE status = "showing"');
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');

    res.json({
      stats: {
        total_orders: totalOrders[0].count,
        total_revenue: parseFloat(totalRevenue[0].total),
        total_movies: totalMovies[0].count,
        total_users: totalUsers[0].count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getOrderStats = async (req, res) => {
  const { type = 'daily' } = req.query;

  try {
    let query;
    
    if (type === 'daily') {
      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    } else if (type === 'monthly') {
      query = `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as date,
          COUNT(*) as order_count,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY date
      `;
    } else {
      return res.status(400).json({ message: '无效的统计类型' });
    }

    const [stats] = await pool.query(query);

    const [movieSales] = await pool.query(`
      SELECT 
        m.title as movie_name,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as revenue
      FROM orders o
      JOIN showtimes s ON o.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      WHERE o.status = 'paid'
      GROUP BY m.id, m.title
      ORDER BY revenue DESC
      LIMIT 10
    `);

    res.json({
      stats: stats.map(s => ({
        date: s.date,
        order_count: s.order_count,
        revenue: parseFloat(s.revenue)
      })),
      movie_sales: movieSales.map(s => ({
        movie_name: s.movie_name,
        order_count: s.order_count,
        revenue: parseFloat(s.revenue)
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getAllOrders = async (req, res) => {
  const { page = 1, page_size = 20, status } = req.query;
  const offset = (page - 1) * page_size;

  try {
    let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1';
    let dataQuery = `
      SELECT o.*, u.username, m.title as movie_title, s.start_time
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN showtimes s ON o.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      dataQuery += ' AND o.status = ?';
      params.push(status);
      countParams.push(status);
    }

    dataQuery += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [countResult] = await pool.query(countQuery, countParams);
    const [orders] = await pool.query(dataQuery, params);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        page_size: parseInt(page_size),
        total: countResult[0].total,
        total_pages: Math.ceil(countResult[0].total / page_size)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

module.exports = { getDashboardStats, getOrderStats, getAllOrders, getAllUsers };

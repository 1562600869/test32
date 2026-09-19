const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const cinemaRoutes = require('./routes/cinemas');
const showtimeRoutes = require('./routes/showtimes');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const { initScheduler } = require('./scheduler/orderScheduler');
const { errorHandler } = require('./errors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  initScheduler();
});

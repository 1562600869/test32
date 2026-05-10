const schedule = require('node-schedule');
const pool = require('../database');

const cancelExpiredOrders = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const [expiredOrders] = await connection.query(`
      SELECT id, order_no FROM orders 
      WHERE status = 'pending' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
      FOR UPDATE
    `);

    if (expiredOrders.length === 0) {
      await connection.commit();
      return;
    }

    const orderIds = expiredOrders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    await connection.query(
      `UPDATE orders SET status = 'cancelled', version = version + 1 
       WHERE id IN (${placeholders})`,
      orderIds
    );

    await connection.query(
      `UPDATE order_seats SET status = 'cancelled', version = version + 1 
       WHERE order_id IN (${placeholders})`,
      orderIds
    );

    await connection.commit();
    console.log(`已取消 ${expiredOrders.length} 个过期订单`);
  } catch (error) {
    await connection.rollback();
    console.error('取消过期订单时出错:', error);
  } finally {
    connection.release();
  }
};

const initScheduler = () => {
  schedule.scheduleJob('*/1 * * * *', cancelExpiredOrders);
  console.log('订单定时任务已启动，每分钟检查一次过期订单');
};

module.exports = { initScheduler, cancelExpiredOrders };

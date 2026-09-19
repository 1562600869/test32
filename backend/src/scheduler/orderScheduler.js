const schedule = require('node-schedule');
const pool = require('../database');

const cancelExpiredOrders = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const [expiredOrders] = await connection.query(`
      SELECT id, order_no FROM orders 
      WHERE status = 'pending' 
      AND COALESCE(expires_at, DATE_ADD(created_at, INTERVAL 15 MINUTE)) <= NOW()
      FOR UPDATE
    `);

    if (expiredOrders.length === 0) {
      await connection.commit();
      return;
    }

    const orderIds = expiredOrders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    await connection.query(
      `UPDATE orders SET status = 'expired', version = version + 1 
       WHERE id IN (${placeholders}) AND status = 'pending'`,
      orderIds
    );

    await connection.query(
      `UPDATE order_seats SET status = 'expired', version = version + 1 
       WHERE order_id IN (${placeholders}) AND status = 'reserved'`,
      orderIds
    );

    await connection.commit();
    console.log(`已释放 ${expiredOrders.length} 个过期订单的座位锁定`);
  } catch (error) {
    await connection.rollback();
    console.error('释放过期订单座位时出错:', error);
  } finally {
    connection.release();
  }
};

const initScheduler = () => {
  // 启动时立即执行一次：进程在“锁定后、支付前”崩溃时，
  // 重启后立刻释放已过期锁定，避免座位被永久占死。
  cancelExpiredOrders();
  schedule.scheduleJob('*/1 * * * *', cancelExpiredOrders);
  console.log('订单定时任务已启动，每分钟检查一次过期订单（锁定 TTL 15 分钟）');
};

module.exports = { initScheduler, cancelExpiredOrders };

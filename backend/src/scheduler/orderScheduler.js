const schedule = require('node-schedule');
const pool = require('../database');
const { LOCK_TTL_MINUTES } = require('../config');

// 过期锁定清扫：把超时未支付的 pending 订单置为 expired 并释放座位。
// 启动时也会执行一次（进程在锁定后崩溃的恢复路径），
// 因此重启不会把锁定座位永久占死，也不会触碰已支付订单。
const cancelExpiredOrders = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const [expiredOrders] = await connection.query(`
      SELECT id, order_no FROM orders 
      WHERE status = 'pending' 
      AND (
        (expires_at IS NOT NULL AND expires_at <= NOW())
        OR (expires_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
      )
      FOR UPDATE
    `, [LOCK_TTL_MINUTES]);

    if (expiredOrders.length === 0) {
      await connection.commit();
      return 0;
    }

    const orderIds = expiredOrders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    await connection.query(
      `UPDATE orders SET status = 'expired', version = version + 1 
       WHERE id IN (${placeholders}) AND status = 'pending'`,
      orderIds
    );

    await connection.query(
      `UPDATE order_seats SET status = 'cancelled', version = version + 1 
       WHERE order_id IN (${placeholders}) AND status = 'reserved'`,
      orderIds
    );

    await connection.commit();
    console.log(`已释放 ${expiredOrders.length} 个过期锁定订单`);
    return expiredOrders.length;
  } catch (error) {
    await connection.rollback();
    console.error('释放过期订单时出错:', error);
    return 0;
  } finally {
    connection.release();
  }
};

const initScheduler = () => {
  // 启动即清扫一次：崩溃恢复
  cancelExpiredOrders().catch((err) => console.error('启动清扫失败:', err));
  schedule.scheduleJob('*/1 * * * *', cancelExpiredOrders);
  console.log(`订单定时任务已启动，每分钟检查一次过期锁定（TTL=${LOCK_TTL_MINUTES} 分钟）`);
};

module.exports = { initScheduler, cancelExpiredOrders };

// 选座锁定 TTL（分钟）。锁定 = 创建 pending 订单并占用 order_seats，
// 超过 TTL 未支付即过期，座位自动释放。可用环境变量覆盖。
const LOCK_TTL_MINUTES = parseInt(process.env.ORDER_LOCK_TTL_MINUTES || '15', 10);
const LOCK_TTL_MS = LOCK_TTL_MINUTES * 60 * 1000;

module.exports = { LOCK_TTL_MINUTES, LOCK_TTL_MS };

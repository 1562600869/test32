-- 002_order_lock_ttl: 选座锁定 TTL 与订单状态机演进
-- 对已有数据库执行本脚本；新库直接使用 database/init.sql。

ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending', 'paid', 'expired', 'cancelled', 'refunded') DEFAULT 'pending',
  ADD COLUMN expires_at TIMESTAMP NULL AFTER paid_at;

-- 历史遗留的 pending 订单补上过期时间，避免被永久占死
UPDATE orders SET expires_at = DATE_ADD(created_at, INTERVAL 15 MINUTE)
WHERE status = 'pending' AND expires_at IS NULL;

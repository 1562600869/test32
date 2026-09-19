-- 选座锁 TTL 与订单状态机演进迁移（已有数据库执行一次即可）
-- 1. 订单增加 expired 状态与 expires_at 锁过期时间
-- 2. order_seats 增加 expired 状态，并用生成列唯一索引保证
--    “同一场次同一座位最多一条有效(reserved/sold)记录”，
--    同时允许同一座位存在多条已取消/已过期历史记录。

ALTER TABLE orders
    MODIFY COLUMN status ENUM('pending', 'paid', 'expired', 'cancelled', 'refunded') DEFAULT 'pending',
    ADD COLUMN expires_at DATETIME NULL AFTER version;

ALTER TABLE order_seats
    MODIFY COLUMN status ENUM('reserved', 'sold', 'expired', 'cancelled') DEFAULT 'reserved',
    ADD COLUMN active_flag TINYINT GENERATED ALWAYS AS (CASE WHEN status IN ('reserved', 'sold') THEN 1 ELSE NULL END) STORED,
    DROP INDEX unique_showtime_seat,
    ADD UNIQUE KEY unique_active_showtime_seat (showtime_id, seat_id, active_flag);

-- 为迁移前已存在的 pending 订单回填过期时间（创建后 15 分钟）
UPDATE orders SET expires_at = DATE_ADD(created_at, INTERVAL 15 MINUTE)
WHERE status = 'pending' AND expires_at IS NULL;

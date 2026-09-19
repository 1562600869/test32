// 订单状态机与锁定 TTL 的纯逻辑（与后端语义一致，见 README）。
// 所有函数都接收显式的 now 参数，测试用假时钟驱动，禁止固定 sleep。

export const ORDER_STATUS = Object.freeze({
  LOCKED: 'pending',     // 已锁定（待支付）
  PAID: 'paid',          // 已支付
  EXPIRED: 'expired',    // 已过期（TTL 到期未支付）
  CANCELLED: 'cancelled' // 已取消
})

export const DEFAULT_LOCK_TTL_MS = 15 * 60 * 1000

// 锁定是否已过期
export function isLockExpired(lockedAtMs, nowMs, ttlMs = DEFAULT_LOCK_TTL_MS) {
  return nowMs - lockedAtMs >= ttlMs
}

// 剩余支付时间（秒），<= 0 表示已过期
export function remainingSeconds(lockedAtMs, nowMs, ttlMs = DEFAULT_LOCK_TTL_MS) {
  return Math.max(0, Math.ceil((lockedAtMs + ttlMs - nowMs) / 1000))
}

// 状态机迁移。返回 { status, changed, ok, reason }。
// - pay:    locked -> paid；对 paid 重复 pay 幂等返回成功（不重复出票）
// - expire: locked -> expired（其他状态不受影响）
// - cancel: locked|paid -> cancelled；对 cancelled 重复取消幂等
export function transition(status, event) {
  switch (event) {
    case 'pay':
      if (status === ORDER_STATUS.LOCKED) return { status: ORDER_STATUS.PAID, changed: true, ok: true }
      if (status === ORDER_STATUS.PAID) return { status, changed: false, ok: true, reason: 'idempotent' }
      return { status, changed: false, ok: false, reason: `cannot pay ${status}` }
    case 'expire':
      if (status === ORDER_STATUS.LOCKED) return { status: ORDER_STATUS.EXPIRED, changed: true, ok: true }
      return { status, changed: false, ok: true, reason: 'no-op' }
    case 'cancel':
      if (status === ORDER_STATUS.LOCKED || status === ORDER_STATUS.PAID) {
        return { status: ORDER_STATUS.CANCELLED, changed: true, ok: true }
      }
      if (status === ORDER_STATUS.CANCELLED) return { status, changed: false, ok: true, reason: 'idempotent' }
      return { status, changed: false, ok: false, reason: `cannot cancel ${status}` }
    default:
      return { status, changed: false, ok: false, reason: `unknown event ${event}` }
  }
}

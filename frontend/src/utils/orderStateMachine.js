// 订单状态机（与后端语义保持一致）：
//
//   pending(锁定中) --支付成功--> paid(已支付)
//   pending(锁定中) --到达 expires_at--> expired(已过期，座位释放)
//   pending(锁定中) --用户取消--> cancelled(已取消)
//   paid --退票/退款--> refunded(已退款)
//
// 终态：paid / expired / cancelled / refunded，均不可再支付。
// 锁 TTL：创建订单时后端写入 expires_at = 创建时间 + 15 分钟。
// 纯函数、时间可注入，便于用假时钟测试。

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
}

export const LOCK_TTL_MS = 15 * 60 * 1000

const TERMINAL_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.EXPIRED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED
])

// 订单锁过期时间：优先服务端 expires_at，回退 created_at + TTL
export function getOrderExpiresAt(order) {
  if (!order) return null
  if (order.expires_at) {
    const expiresAt = new Date(order.expires_at)
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt
  }
  if (order.created_at) {
    const createdAt = new Date(order.created_at)
    if (!Number.isNaN(createdAt.getTime())) {
      return new Date(createdAt.getTime() + LOCK_TTL_MS)
    }
  }
  return null
}

export function isOrderExpired(order, now = new Date()) {
  if (!order || order.status !== ORDER_STATUS.PENDING) return false
  const expiresAt = getOrderExpiresAt(order)
  if (!expiresAt) return false
  return now.getTime() >= expiresAt.getTime()
}

// 剩余支付时间（秒），非 pending 或已过期返回 0
export function getRemainingSeconds(order, now = new Date()) {
  if (!order || order.status !== ORDER_STATUS.PENDING) return 0
  const expiresAt = getOrderExpiresAt(order)
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
}

export function canPay(order, now = new Date()) {
  return !!order && order.status === ORDER_STATUS.PENDING && !isOrderExpired(order, now)
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status)
}

// 状态迁移：给定事件返回新状态，非法迁移返回 null。
// event: 'pay' | 'expire' | 'cancel' | 'refund'
export function nextStatus(currentStatus, event) {
  const transitions = {
    [ORDER_STATUS.PENDING]: {
      pay: ORDER_STATUS.PAID,
      expire: ORDER_STATUS.EXPIRED,
      cancel: ORDER_STATUS.CANCELLED
    },
    [ORDER_STATUS.PAID]: {
      refund: ORDER_STATUS.REFUNDED
    }
  }
  const next = transitions[currentStatus] && transitions[currentStatus][event]
  return next || null
}

// 模拟服务端 TTL 释放：对 pending 且已过期的订单返回 expired 新状态，
// 未过期或终态订单原样返回。用于测试与文档化语义。
export function releaseIfExpired(order, now = new Date()) {
  if (isOrderExpired(order, now)) {
    return { ...order, status: ORDER_STATUS.EXPIRED }
  }
  return order
}

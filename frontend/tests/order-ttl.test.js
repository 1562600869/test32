// TTL 释放：锁定 15 分钟到期后订单进入 expired，座位语义上被释放。
// 使用注入时钟与 node:test mock.timers 假时钟，不使用固定 sleep。
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_STATUS,
  LOCK_TTL_MS,
  getOrderExpiresAt,
  isOrderExpired,
  getRemainingSeconds,
  canPay,
  nextStatus,
  releaseIfExpired
} from '../src/utils/orderStateMachine.js'

const lockedOrder = {
  id: 1,
  order_no: 'MT20260919ABC',
  status: 'pending',
  created_at: '2026-09-19 12:00:00',
  expires_at: '2026-09-19 12:15:00'
}

test('锁 TTL 为 15 分钟', () => {
  assert.equal(LOCK_TTL_MS, 15 * 60 * 1000)
  // expires_at 与 created_at 之差恰好是 TTL（与时区无关）
  const expiresAt = getOrderExpiresAt(lockedOrder)
  const createdAt = new Date(lockedOrder.created_at)
  assert.equal(expiresAt.getTime() - createdAt.getTime(), LOCK_TTL_MS)
})

test('无 expires_at 时回退为 created_at + 15 分钟', () => {
  const order = { status: 'pending', created_at: '2026-09-19 12:00:00' }
  const expiresAt = getOrderExpiresAt(order)
  assert.equal(expiresAt.getTime() - new Date(order.created_at).getTime(), LOCK_TTL_MS)
})

test('TTL 到期前未过期，到期后自动过期并释放', () => {
  const expiresAt = getOrderExpiresAt(lockedOrder)
  const beforeExpiry = new Date(expiresAt.getTime() - 1000)
  const atExpiry = expiresAt

  assert.equal(isOrderExpired(lockedOrder, beforeExpiry), false)
  assert.equal(isOrderExpired(lockedOrder, atExpiry), true)

  // 到期后状态机迁移为 expired（座位锁释放）
  const released = releaseIfExpired(lockedOrder, atExpiry)
  assert.equal(released.status, ORDER_STATUS.EXPIRED)
  // 未到期订单原样返回
  assert.equal(releaseIfExpired(lockedOrder, beforeExpiry), lockedOrder)
})

test('剩余支付时间随时钟推进递减（假时钟）', () => {
  const expiresAt = getOrderExpiresAt(lockedOrder)
  const lockStart = expiresAt.getTime() - LOCK_TTL_MS
  mock.timers.enable({ apis: ['Date'], now: lockStart })
  try {
    assert.equal(getRemainingSeconds(lockedOrder), 15 * 60)

    mock.timers.tick(60 * 1000)
    assert.equal(getRemainingSeconds(lockedOrder), 14 * 60)

    mock.timers.tick(14 * 60 * 1000)
    assert.equal(getRemainingSeconds(lockedOrder), 0)
    assert.equal(canPay(lockedOrder), false)
  } finally {
    mock.timers.reset()
  }
})

test('已支付订单永不过期，重启后不会被当成未支付释放', () => {
  const paidOrder = { ...lockedOrder, status: 'paid', paid_at: '2026-09-19 12:05:00' }
  const longAfter = new Date(getOrderExpiresAt(lockedOrder).getTime() + 24 * 3600 * 1000)

  assert.equal(isOrderExpired(paidOrder, longAfter), false)
  assert.equal(releaseIfExpired(paidOrder, longAfter), paidOrder)
  assert.equal(canPay(paidOrder, longAfter), false)
})

test('状态机合法迁移与非法迁移', () => {
  assert.equal(nextStatus('pending', 'pay'), 'paid')
  assert.equal(nextStatus('pending', 'expire'), 'expired')
  assert.equal(nextStatus('pending', 'cancel'), 'cancelled')
  assert.equal(nextStatus('paid', 'refund'), 'refunded')
  // 终态不可再支付/取消
  assert.equal(nextStatus('expired', 'pay'), null)
  assert.equal(nextStatus('cancelled', 'pay'), null)
  assert.equal(nextStatus('paid', 'expire'), null)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_STATUS,
  DEFAULT_LOCK_TTL_MS,
  isLockExpired,
  remainingSeconds,
  transition
} from '../src/utils/orderLock.js'

test('TTL：到期前未过期，到期后自动过期（注入时钟，无固定 sleep）', () => {
  const lockedAt = 1_000_000
  assert.equal(isLockExpired(lockedAt, lockedAt + DEFAULT_LOCK_TTL_MS - 1), false)
  assert.equal(isLockExpired(lockedAt, lockedAt + DEFAULT_LOCK_TTL_MS), true)
  assert.equal(isLockExpired(lockedAt, lockedAt + DEFAULT_LOCK_TTL_MS + 60_000), true)
})

test('TTL：剩余支付秒数随假时钟推进而减少', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 })
  const lockedAt = Date.now()
  assert.equal(remainingSeconds(lockedAt, Date.now(), 60_000), 60)
  t.mock.timers.tick(30_000)
  assert.equal(remainingSeconds(lockedAt, Date.now(), 60_000), 30)
  t.mock.timers.tick(31_000)
  assert.equal(remainingSeconds(lockedAt, Date.now(), 60_000), 0)
  assert.equal(isLockExpired(lockedAt, Date.now(), 60_000), true)
  t.mock.timers.reset()
})

test('状态机：锁定 -> 已支付', () => {
  const r = transition(ORDER_STATUS.LOCKED, 'pay')
  assert.equal(r.ok, true)
  assert.equal(r.status, ORDER_STATUS.PAID)
  assert.equal(r.changed, true)
})

test('支付幂等：重复支付已支付订单返回成功且不产生状态变更', () => {
  const r = transition(ORDER_STATUS.PAID, 'pay')
  assert.equal(r.ok, true)
  assert.equal(r.changed, false)
  assert.equal(r.status, ORDER_STATUS.PAID)
})

test('过期/已取消订单不可支付', () => {
  assert.equal(transition(ORDER_STATUS.EXPIRED, 'pay').ok, false)
  assert.equal(transition(ORDER_STATUS.CANCELLED, 'pay').ok, false)
})

test('TTL 释放：锁定 -> 已过期；过期不影响已支付订单', () => {
  const expired = transition(ORDER_STATUS.LOCKED, 'expire')
  assert.equal(expired.status, ORDER_STATUS.EXPIRED)
  assert.equal(expired.changed, true)

  const paid = transition(ORDER_STATUS.PAID, 'expire')
  assert.equal(paid.status, ORDER_STATUS.PAID)
  assert.equal(paid.changed, false)
})

test('取消：锁定/已支付可取消，重复取消幂等', () => {
  assert.equal(transition(ORDER_STATUS.LOCKED, 'cancel').status, ORDER_STATUS.CANCELLED)
  assert.equal(transition(ORDER_STATUS.PAID, 'cancel').status, ORDER_STATUS.CANCELLED)
  const again = transition(ORDER_STATUS.CANCELLED, 'cancel')
  assert.equal(again.ok, true)
  assert.equal(again.changed, false)
  assert.equal(transition(ORDER_STATUS.EXPIRED, 'cancel').ok, false)
})

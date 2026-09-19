// 后端断开 / 超时 / 409 时的 UI 错误态：必须映射为可展示、可重试的状态，
// 而不是只在控制台报错。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyApiError, ERROR_TYPES } from '../src/utils/apiErrors.js'

test('后端不可达（网络错误）映射为可重试的错误态', () => {
  const state = classifyApiError({
    code: 'NETWORK_ERROR',
    isNetworkError: true,
    message: '无法连接服务器，请检查网络后重试'
  })

  assert.equal(state.type, ERROR_TYPES.NETWORK)
  assert.equal(state.retryable, true)
  assert.ok(state.message.length > 0)
})

test('请求超时映射为可重试的错误态', () => {
  const state = classifyApiError({
    code: 'TIMEOUT',
    isTimeout: true,
    isNetworkError: true,
    message: '请求超时，请检查网络后重试'
  })

  assert.equal(state.type, ERROR_TYPES.TIMEOUT)
  assert.equal(state.retryable, true)
})

test('409 座位冲突映射为冲突态并携带坐标', () => {
  const state = classifyApiError({
    code: 'SEAT_CONFLICT',
    status: 409,
    showtime_id: 9,
    conflict_seats: [{ seat_id: 11, row: 2, col: 3 }]
  })

  assert.equal(state.type, ERROR_TYPES.CONFLICT)
  assert.equal(state.showtimeId, 9)
  assert.deepEqual(state.conflictSeats, [{ seat_id: 11, row: 2, col: 3 }])
  assert.match(state.message, /场次 9/)
  assert.match(state.message, /2排3座/)
})

test('订单过期映射为不可重试的过期态', () => {
  const state = classifyApiError({ code: 'ORDER_EXPIRED', order_status: 'expired' })
  assert.equal(state.type, ERROR_TYPES.EXPIRED)
  assert.equal(state.retryable, false)
})

test('5xx 服务器错误映射为可重试的服务器错误态', () => {
  const state = classifyApiError({ status: 500, message: '服务器内部错误' })
  assert.equal(state.type, ERROR_TYPES.SERVER)
  assert.equal(state.retryable, true)
})

test('空错误与非对象错误也有兜底文案', () => {
  assert.equal(classifyApiError(null).type, ERROR_TYPES.UNKNOWN)
  assert.equal(classifyApiError(undefined).retryable, true)
  assert.equal(classifyApiError('boom').type, ERROR_TYPES.UNKNOWN)
  assert.ok(classifyApiError({}).message.length > 0)
})

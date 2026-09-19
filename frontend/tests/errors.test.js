import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ApiError,
  NetworkError,
  TimeoutError,
  SeatConflictError,
  ConflictError,
  normalizeApiError,
  describeError
} from '../src/utils/errors.js'

test('409 SEAT_CONFLICT 归一化为 SeatConflictError，含场次 ID 与座位坐标', () => {
  const axiosError = {
    response: {
      status: 409,
      data: {
        message: '场次 42 的座位 3排5座 已被其他用户锁定或售出，请重新选择',
        code: 'SEAT_CONFLICT',
        showtime_id: 42,
        seats: [{ row: 3, col: 5 }]
      }
    }
  }
  const err = normalizeApiError(axiosError)
  assert.ok(err instanceof SeatConflictError)
  assert.equal(err.status, 409)
  assert.equal(err.showtimeId, 42)
  assert.deepEqual(err.seats, [{ row: 3, col: 5 }])
  assert.equal(err.retryable, true)
})

test('诊断文案包含场次 ID 与座位坐标', () => {
  const err = new SeatConflictError('座位冲突', {
    showtime_id: 42,
    seats: [{ row: 3, col: 5 }, { row: 3, col: 6 }]
  })
  const text = describeError(err)
  assert.match(text, /42/)
  assert.match(text, /3排5座/)
  assert.match(text, /3排6座/)
})

test('后端不可达（无响应）归一化为 NetworkError 且可重试', () => {
  const err = normalizeApiError({ request: {}, message: 'Network Error' })
  assert.ok(err instanceof NetworkError)
  assert.equal(err.code, 'NETWORK_ERROR')
  assert.equal(err.retryable, true)
})

test('超时归一化为 TimeoutError 且可重试', () => {
  const err = normalizeApiError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })
  assert.ok(err instanceof TimeoutError)
  assert.equal(err.retryable, true)
})

test('其他 409 归一化为 ConflictError（如场次布局锁定）', () => {
  const err = normalizeApiError({
    response: {
      status: 409,
      data: { message: '场次 7 存在已锁定或已售座位', code: 'SHOWTIME_LAYOUT_LOCKED', showtime_id: 7 }
    }
  })
  assert.ok(err instanceof ConflictError)
  assert.equal(err.code, 'SHOWTIME_LAYOUT_LOCKED')
  assert.equal(err.details.showtime_id, 7)
})

test('5xx 归一化为 ApiError 且可重试', () => {
  const err = normalizeApiError({ response: { status: 500, data: { message: '服务器内部错误' } } })
  assert.ok(err instanceof ApiError)
  assert.equal(err.retryable, true)
})

// 冲突占座：服务端 409 后，本地座位图必须立刻回到正确态，
// 且错误文案包含场次 ID 与座位坐标。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markSeatsUnavailable, removeConflictedSelection, seatAriaLabel } from '../src/utils/seatMap.js'
import { classifyApiError, formatSeatConflictMessage, ERROR_TYPES } from '../src/utils/apiErrors.js'

const buildSeats = () => ([
  { id: 1, row_number: 3, col_number: 5, seat_type: 'normal', is_sold: false },
  { id: 2, row_number: 3, col_number: 6, seat_type: 'normal', is_sold: false },
  { id: 3, row_number: 4, col_number: 1, seat_type: 'vip', is_sold: false }
])

const conflictError = {
  code: 'SEAT_CONFLICT',
  status: 409,
  showtime_id: 42,
  conflict_seats: [
    { seat_id: 1, row: 3, col: 5, held_status: 'reserved' },
    { seat_id: 2, row: 3, col: 6, held_status: 'sold' }
  ]
}

test('冲突座位被标记为不可选，其余座位不受影响', () => {
  const seats = buildSeats()
  const updated = markSeatsUnavailable(seats, conflictError.conflict_seats)

  assert.equal(updated[0].is_sold, true)
  assert.equal(updated[1].is_sold, true)
  assert.equal(updated[2].is_sold, false)
  // 不修改原数组，避免双方都显示“已选”的中间态
  assert.equal(seats[0].is_sold, false)
})

test('冲突座位从已选列表中移除', () => {
  const remaining = removeConflictedSelection([1, 2, 3], conflictError.conflict_seats)
  assert.deepEqual(remaining, [3])
})

test('无冲突时座位与选择保持不变', () => {
  const seats = buildSeats()
  assert.deepEqual(markSeatsUnavailable(seats, []), seats)
  assert.deepEqual(removeConflictedSelection([1, 2], []), [1, 2])
})

test('409 错误被分类为冲突，文案包含场次 ID 与座位坐标', () => {
  const classified = classifyApiError(conflictError)
  assert.equal(classified.type, ERROR_TYPES.CONFLICT)
  assert.equal(classified.retryable, true)
  assert.match(classified.message, /场次 42/)
  assert.match(classified.message, /3排5座/)
  assert.match(classified.message, /3排6座/)

  const message = formatSeatConflictMessage(conflictError)
  assert.match(message, /42/)
  assert.match(message, /3排5座、3排6座/)
})

test('缺少坐标时仍给出含场次 ID 的可诊断文案', () => {
  const message = formatSeatConflictMessage({ showtime_id: 7, conflict_seats: [] })
  assert.match(message, /场次 7/)
})

test('座位 aria 文案包含行、列与状态', () => {
  const seat = { id: 1, row_number: 3, col_number: 5, seat_type: 'normal', is_sold: false }
  assert.match(seatAriaLabel(seat, false), /3排5座，可选/)
  assert.match(seatAriaLabel(seat, true), /3排5座，已选中/)
  assert.match(seatAriaLabel({ ...seat, is_sold: true }, false), /已售，不可选择/)
  assert.match(seatAriaLabel({ ...seat, seat_type: 'vip' }, false), /VIP 座/)
})

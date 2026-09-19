import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SEAT_STATE,
  seatState,
  removeConflictSeats,
  reconcileSelection,
  seatAriaLabel,
  selectionSummary
} from '../src/utils/seatMap.js'

const seat = (id, row, col, is_sold = false, seat_type = 'normal') =>
  ({ id, row_number: row, col_number: col, is_sold, seat_type })

test('并发占座冲突：失败方移除冲突座位，不会显示为已选', () => {
  const selected = [seat(1, 3, 5), seat(2, 3, 6)]
  const remaining = removeConflictSeats(selected, [{ row: 3, col: 5 }])
  assert.deepEqual(remaining.map((s) => s.id), [2])
})

test('以服务端为准重算：已售座位从本地已选剔除', () => {
  const selected = [seat(1, 3, 5), seat(2, 3, 6)]
  const serverSeats = [seat(1, 3, 5, true), seat(2, 3, 6, false)]
  const reconciled = reconcileSelection(selected, serverSeats)
  assert.deepEqual(reconciled.map((s) => s.id), [2])
})

test('座位状态：已售 > 已选 > 可选', () => {
  assert.equal(seatState(seat(1, 1, 1, true), true), SEAT_STATE.SOLD)
  assert.equal(seatState(seat(1, 1, 1, false), true), SEAT_STATE.SELECTED)
  assert.equal(seatState(seat(1, 1, 1, false), false), SEAT_STATE.AVAILABLE)
})

test('aria-label 含行、列与状态', () => {
  assert.equal(seatAriaLabel(seat(1, 3, 5), SEAT_STATE.AVAILABLE), '3排5座，可选')
  assert.equal(seatAriaLabel(seat(1, 3, 5), SEAT_STATE.SELECTED), '3排5座，已选')
  assert.equal(seatAriaLabel(seat(1, 3, 5), SEAT_STATE.SOLD), '3排5座，已售')
  assert.equal(seatAriaLabel(seat(1, 3, 5, false, 'vip'), SEAT_STATE.AVAILABLE), '3排5座，VIP 可选')
})

test('已选数量播报', () => {
  assert.equal(selectionSummary(0), '未选择座位')
  assert.equal(selectionSummary(3), '已选 3 个座位')
})

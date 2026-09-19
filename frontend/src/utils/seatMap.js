// 座位图状态与冲突处理的纯逻辑。
// 状态以服务端为准：本地"已选"只是未提交的意图，
// 提交失败（409）时必须用服务端座位图重算本地状态。

export const SEAT_STATE = Object.freeze({
  AVAILABLE: 'available',
  SELECTED: 'selected',
  SOLD: 'sold',
  LOCKED: 'locked'
})

// 计算单个座位的展示状态
export function seatState(seat, isSelected) {
  if (seat.is_sold) return SEAT_STATE.SOLD
  if (isSelected) return SEAT_STATE.SELECTED
  return SEAT_STATE.AVAILABLE
}

// 409 冲突后：把冲突座位从已选列表移除，返回新的已选列表。
// conflictSeats: [{row, col}]
export function removeConflictSeats(selectedSeats, conflictSeats) {
  const conflictKeys = new Set(conflictSeats.map((s) => `${s.row}:${s.col}`))
  return selectedSeats.filter(
    (seat) => !conflictKeys.has(`${seat.row_number}:${seat.col_number}`)
  )
}

// 用服务端最新座位图重算本地已选列表：
// 已被售出/锁定的本地已选座位一律丢弃（服务端为准），
// 保证不会出现"双方都显示已选"。
export function reconcileSelection(selectedSeats, serverSeats) {
  const serverById = new Map(serverSeats.map((s) => [s.id, s]))
  return selectedSeats.filter((seat) => {
    const serverSeat = serverById.get(seat.id)
    return serverSeat && !serverSeat.is_sold
  })
}

// 可访问性：座位 aria-label（含行、列、状态）
export function seatAriaLabel(seat, state) {
  const stateText = {
    [SEAT_STATE.AVAILABLE]: '可选',
    [SEAT_STATE.SELECTED]: '已选',
    [SEAT_STATE.SOLD]: '已售',
    [SEAT_STATE.LOCKED]: '锁定中'
  }[state] || '未知'
  const typeText = seat.seat_type === 'vip' ? 'VIP ' : ''
  return `${seat.row_number}排${seat.col_number}座，${typeText}${stateText}`
}

// 已选数量的 aria-live 播报文案
export function selectionSummary(count) {
  return count > 0 ? `已选 ${count} 个座位` : '未选择座位'
}

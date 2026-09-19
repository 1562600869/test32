// 座位图状态工具：把服务端冲突结果应用到本地座位图，
// 保证冲突失败后座位图立刻回到“可点/已售”的正确态。
// 纯函数、无框架依赖，便于 node --test 直接测试。

// 将冲突座位标记为不可选（is_sold=true），返回新数组，不修改入参。
export function markSeatsUnavailable(seats, conflictSeats) {
  if (!Array.isArray(conflictSeats) || conflictSeats.length === 0) {
    return seats.slice()
  }
  const conflictIds = new Set(conflictSeats.map(s => s.seat_id))
  return seats.map(seat => (
    conflictIds.has(seat.id) ? { ...seat, is_sold: true } : seat
  ))
}

// 从已选座位 id 列表中移除冲突座位，返回剩余 id。
export function removeConflictedSelection(selectedSeatIds, conflictSeats) {
  if (!Array.isArray(conflictSeats) || conflictSeats.length === 0) {
    return selectedSeatIds.slice()
  }
  const conflictIds = new Set(conflictSeats.map(s => s.seat_id))
  return selectedSeatIds.filter(id => !conflictIds.has(id))
}

// 座位可访问性文案：当前行、坐标与状态（可选/已选/已售/VIP）
export function seatAriaLabel(seat, isSelected) {
  const base = `${seat.row_number}排${seat.col_number}座`
  if (seat.is_sold) return `${base}，已售，不可选择`
  if (isSelected) return `${base}，已选中，按回车取消选择`
  if (seat.seat_type === 'vip') return `${base}，VIP 座，可选，按回车选择`
  return `${base}，可选，按回车选择`
}

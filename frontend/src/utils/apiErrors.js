// 统一的 API 错误分类：把 request 拦截器抛出的错误对象映射为
// 页面可直接渲染的错误态（类型 / 文案 / 是否可重试）。
// 纯函数、无框架依赖，便于 node --test 直接测试。

export const ERROR_TYPES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  CONFLICT: 'conflict',
  EXPIRED: 'expired',
  SERVER: 'server',
  UNKNOWN: 'unknown'
}

export function classifyApiError(error) {
  if (!error || typeof error !== 'object') {
    return { type: ERROR_TYPES.UNKNOWN, message: '未知错误，请稍后重试', retryable: true }
  }

  if (error.isTimeout) {
    return { type: ERROR_TYPES.TIMEOUT, message: error.message || '请求超时，请检查网络后重试', retryable: true }
  }

  if (error.isNetworkError) {
    return { type: ERROR_TYPES.NETWORK, message: error.message || '无法连接服务器，请检查网络后重试', retryable: true }
  }

  if (error.code === 'SEAT_CONFLICT') {
    return {
      type: ERROR_TYPES.CONFLICT,
      message: formatSeatConflictMessage(error),
      retryable: true,
      showtimeId: error.showtime_id,
      conflictSeats: error.conflict_seats || []
    }
  }

  if (error.code === 'ORDER_EXPIRED') {
    return { type: ERROR_TYPES.EXPIRED, message: error.message || '订单已过期，请重新下单', retryable: false }
  }

  if (typeof error.status === 'number' && error.status >= 500) {
    return { type: ERROR_TYPES.SERVER, message: error.message || '服务器开小差了，请稍后重试', retryable: true }
  }

  return { type: ERROR_TYPES.UNKNOWN, message: error.message || '操作失败，请稍后重试', retryable: true }
}

// 生成包含场次 ID 与座位坐标的可诊断冲突文案
export function formatSeatConflictMessage(error) {
  const showtimeId = error && error.showtime_id != null ? error.showtime_id : '未知'
  const seats = (error && Array.isArray(error.conflict_seats)) ? error.conflict_seats : []
  if (seats.length === 0) {
    return `场次 ${showtimeId} 的座位已被其他用户锁定或售出，请刷新后重新选择`
  }
  const seatText = seats.map(s => `${s.row}排${s.col}座`).join('、')
  return `场次 ${showtimeId} 的以下座位已被锁定或售出：${seatText}，请重新选择`
}

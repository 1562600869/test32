// 公开错误类型：前端所有 API 错误都归一化为 ApiError 子类，
// UI 据此渲染明确的错误态/空态，而不是只打 console。

export class ApiError extends Error {
  constructor(code, message, { status = 0, retryable = false, details = {} } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryable = retryable
    this.details = details
  }
}

// 后端不可达（连接被拒绝、DNS 失败等）
export class NetworkError extends ApiError {
  constructor(message = '无法连接到服务器，请检查网络后重试') {
    super('NETWORK_ERROR', message, { retryable: true })
    this.name = 'NetworkError'
  }
}

// 请求超时
export class TimeoutError extends ApiError {
  constructor(message = '请求超时，请重试') {
    super('TIMEOUT', message, { retryable: true })
    this.name = 'TimeoutError'
  }
}

// 409 座位锁定冲突：details 必含 showtime_id 与 seats 坐标
export class SeatConflictError extends ApiError {
  constructor(message, details = {}) {
    super('SEAT_CONFLICT', message, { status: 409, retryable: true, details })
    this.name = 'SeatConflictError'
    this.showtimeId = details.showtime_id
    this.seats = details.seats || []
  }
}

// 其他 409 状态冲突（订单状态、场次布局锁定等）
export class ConflictError extends ApiError {
  constructor(code, message, details = {}) {
    super(code || 'CONFLICT', message, { status: 409, retryable: false, details })
    this.name = 'ConflictError'
  }
}

// 把 axios 错误 / 后端错误体归一化为公开错误类型
export function normalizeApiError(error) {
  if (error instanceof ApiError) return error

  // axios 超时
  if (error && error.code === 'ECONNABORTED') {
    return new TimeoutError()
  }

  // 有响应：后端返回了结构化错误
  if (error && error.response) {
    const { status, data } = error.response
    const body = data || {}
    const message = body.message || `请求失败（HTTP ${status}）`
    const details = { ...body }
    delete details.message
    delete details.code

    if (status === 409) {
      if (body.code === 'SEAT_CONFLICT') {
        return new SeatConflictError(message, details)
      }
      return new ConflictError(body.code, message, details)
    }
    return new ApiError(body.code || `HTTP_${status}`, message, {
      status,
      retryable: status >= 500,
      details
    })
  }

  // 无响应：后端不可达
  if (error && error.request) {
    return new NetworkError()
  }

  // 已被 request.js 拦截器拍平的对象
  if (error && typeof error === 'object' && 'message' in error && !error.config) {
    return new ApiError(error.code || 'UNKNOWN', error.message, {
      retryable: Boolean(error.retryable)
    })
  }

  return new ApiError('UNKNOWN', '未知错误，请重试', { retryable: true })
}

// 供 UI 展示的一行诊断信息（含场次 ID 与座位坐标）
export function describeError(error) {
  const err = normalizeApiError(error)
  if (err instanceof SeatConflictError) {
    const seatText = err.seats.map((s) => `${s.row}排${s.col}座`).join('、')
    return `场次 ${err.showtimeId} 座位冲突：${seatText} 已被他人锁定或售出`
  }
  return err.message
}

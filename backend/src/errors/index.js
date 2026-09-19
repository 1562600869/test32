// 公开错误类型：所有业务错误都带有稳定的 code，前端据此做可诊断展示。
// 响应体统一为 { message, code, ...details }

class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 座位锁定冲突：同一场次同一座位被并发锁定时，最多一人成功。
// details 必含 showtime_id 与冲突座位坐标 seats: [{row, col}]。
class SeatConflictError extends ApiError {
  constructor(showtimeId, seats) {
    const seatText = seats.map((s) => `${s.row}排${s.col}座`).join('、');
    super(
      409,
      'SEAT_CONFLICT',
      `场次 ${showtimeId} 的座位 ${seatText} 已被其他用户锁定或售出，请重新选择`,
      { showtime_id: showtimeId, seats }
    );
  }
}

// 订单状态机非法迁移（如对非 pending 订单支付/取消）
class OrderStateError extends ApiError {
  constructor(orderNo, currentStatus, action) {
    super(
      409,
      'ORDER_STATE_CONFLICT',
      `订单 ${orderNo} 当前状态为 ${currentStatus}，无法执行 ${action}`,
      { order_no: orderNo, status: currentStatus, action }
    );
  }
}

// 管理端：场次存在被锁定或已售座位，禁止覆盖座位布局
class ShowtimeLayoutLockedError extends ApiError {
  constructor(showtimeId) {
    super(
      409,
      'SHOWTIME_LAYOUT_LOCKED',
      `场次 ${showtimeId} 存在已锁定或已售座位，禁止修改影厅/座位布局或删除`,
      { showtime_id: showtimeId }
    );
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      ...err.details
    });
  }
  console.error(err.stack || err);
  res.status(500).json({ message: '服务器内部错误', code: 'INTERNAL_ERROR' });
};

module.exports = {
  ApiError,
  SeatConflictError,
  OrderStateError,
  ShowtimeLayoutLockedError,
  errorHandler
};

// 页面视图状态解析：loading / error(可重试) / empty / ready。
// 后端不可达、超时、409 都必须落到明确的 UI 状态，禁止只打 console。

import { normalizeApiError } from './errors.js'

export const VIEW_STATE = Object.freeze({
  LOADING: 'loading',
  ERROR: 'error',
  EMPTY: 'empty',
  READY: 'ready'
})

// data 为空数组/ null 时视为空态
export function resolveViewState({ loading, error, data }) {
  if (loading) return { type: VIEW_STATE.LOADING }
  if (error) {
    const err = normalizeApiError(error)
    return {
      type: VIEW_STATE.ERROR,
      error: err,
      message: err.message,
      retryable: err.retryable !== false
    }
  }
  const isEmpty =
    data == null || (Array.isArray(data) && data.length === 0)
  if (isEmpty) return { type: VIEW_STATE.EMPTY }
  return { type: VIEW_STATE.READY }
}

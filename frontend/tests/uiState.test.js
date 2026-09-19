import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveViewState, VIEW_STATE } from '../src/utils/uiState.js'
import { normalizeApiError } from '../src/utils/errors.js'

test('加载中', () => {
  assert.equal(resolveViewState({ loading: true, error: null, data: null }).type, VIEW_STATE.LOADING)
})

test('后端断开：进入可重试的错误态，而不是只有 console 报错', () => {
  const networkError = normalizeApiError({ request: {}, message: 'Network Error' })
  const state = resolveViewState({ loading: false, error: networkError, data: null })
  assert.equal(state.type, VIEW_STATE.ERROR)
  assert.equal(state.retryable, true)
  assert.ok(state.message.length > 0)
})

test('超时：进入可重试的错误态', () => {
  const timeoutError = normalizeApiError({ code: 'ECONNABORTED' })
  const state = resolveViewState({ loading: false, error: timeoutError, data: null })
  assert.equal(state.type, VIEW_STATE.ERROR)
  assert.equal(state.retryable, true)
})

test('409 冲突：错误态且可重试', () => {
  const conflict = normalizeApiError({
    response: { status: 409, data: { message: '座位冲突', code: 'SEAT_CONFLICT', showtime_id: 1, seats: [] } }
  })
  const state = resolveViewState({ loading: false, error: conflict, data: null })
  assert.equal(state.type, VIEW_STATE.ERROR)
  assert.equal(state.retryable, true)
})

test('空数据为空态，有数据为就绪态', () => {
  assert.equal(resolveViewState({ loading: false, error: null, data: [] }).type, VIEW_STATE.EMPTY)
  assert.equal(resolveViewState({ loading: false, error: null, data: null }).type, VIEW_STATE.EMPTY)
  assert.equal(resolveViewState({ loading: false, error: null, data: [{}] }).type, VIEW_STATE.READY)
})

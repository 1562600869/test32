// 支付幂等：重复点击支付只产生一次真实请求；
// 服务端返回“已支付”时按成功处理，不会生成第二笔有效票。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentSubmitter } from '../src/utils/paymentSubmitter.js'

// 可手动控制 resolve 时机的 Promise（事件驱动，不用 sleep）
const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('并发重复提交只触发一次支付请求', async () => {
  const gate = deferred()
  let calls = 0
  const payApi = () => {
    calls += 1
    return gate.promise
  }
  const submitter = createPaymentSubmitter({ payApi })

  const first = submitter.submit('MT001')
  const second = submitter.submit('MT001')
  const third = submitter.submit('MT001')

  gate.resolve({ message: '支付成功', order_no: 'MT001' })
  const results = await Promise.all([first, second, third])

  assert.equal(calls, 1)
  for (const result of results) {
    assert.equal(result.ok, true)
  }
})

test('服务端返回 already_paid 时按幂等成功处理', async () => {
  const payApi = async () => ({ message: '订单已支付，请勿重复操作', already_paid: true })
  const submitter = createPaymentSubmitter({ payApi })

  const result = await submitter.submit('MT002')
  assert.equal(result.ok, true)
  assert.equal(result.alreadyPaid, true)
})

test('订单已是 paid 状态的错误响应按幂等成功处理', async () => {
  const payApi = async () => {
    throw { code: 'ORDER_NOT_PAYABLE', order_status: 'paid', message: '订单状态为 paid，不允许支付' }
  }
  const submitter = createPaymentSubmitter({ payApi })

  const result = await submitter.submit('MT003')
  assert.equal(result.ok, true)
  assert.equal(result.alreadyPaid, true)
})

test('过期订单错误正常抛出，且后续可重新提交', async () => {
  let calls = 0
  const payApi = async () => {
    calls += 1
    if (calls === 1) {
      throw { code: 'ORDER_EXPIRED', order_status: 'expired', message: '订单已超时' }
    }
    return { message: '支付成功' }
  }
  const submitter = createPaymentSubmitter({ payApi })

  await assert.rejects(submitter.submit('MT004'), (err) => {
    assert.equal(err.code, 'ORDER_EXPIRED')
    return true
  })

  // 失败后 in-flight 被清理，允许再次提交（如新订单）
  const result = await submitter.submit('MT005')
  assert.equal(result.ok, true)
  assert.equal(calls, 2)
})

test('非幂等错误（如网络错误）原样抛出', async () => {
  const payApi = async () => {
    throw { code: 'NETWORK_ERROR', isNetworkError: true, message: '无法连接服务器' }
  }
  const submitter = createPaymentSubmitter({ payApi })

  await assert.rejects(submitter.submit('MT006'), (err) => {
    assert.equal(err.code, 'NETWORK_ERROR')
    return true
  })
})

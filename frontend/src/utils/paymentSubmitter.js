// 幂等支付提交器：
// - 同一订单并发重复提交只产生一次真实请求（共享 in-flight Promise）；
// - 服务端返回 already_paid 或订单已是 paid 状态时视为成功（幂等语义），
//   重复点击支付不会生成第二笔有效票。
// 纯逻辑、API 可注入，便于 node --test 直接测试。

export function createPaymentSubmitter({ payApi }) {
  if (typeof payApi !== 'function') {
    throw new TypeError('payApi must be a function')
  }

  let inFlight = null

  const submit = (orderNo) => {
    if (inFlight) {
      return inFlight
    }

    inFlight = (async () => {
      try {
        const res = await payApi(orderNo)
        return { ok: true, alreadyPaid: !!(res && res.already_paid), data: res }
      } catch (error) {
        // 后端返回订单已是 paid 状态时按成功处理（支付幂等）
        if (error && error.order_status === 'paid') {
          return { ok: true, alreadyPaid: true, data: error }
        }
        throw error
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  return { submit }
}

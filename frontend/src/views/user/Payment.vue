<template>
  <div class="payment-page">
    <div class="container">
      <div class="payment-card card">
        <div class="payment-header">
          <h1>💰 支付确认</h1>
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="error" class="error-section">
          <div class="error-icon">❌</div>
          <p class="error-text">{{ error }}</p>
          <div class="error-actions">
            <button class="btn btn-primary" @click="loadOrder">重试</button>
            <button class="btn btn-secondary" @click="goHome">返回首页</button>
          </div>
        </div>

        <div v-else class="payment-content">
          <div class="order-info">
            <div class="info-row">
              <span class="label">订单编号</span>
              <span class="value">{{ order?.order_no }}</span>
            </div>
            <div class="info-row">
              <span class="label">电影名称</span>
              <span class="value">{{ order?.movie_title }}</span>
            </div>
            <div class="info-row">
              <span class="label">影院</span>
              <span class="value">{{ order?.cinema_name }}</span>
            </div>
            <div class="info-row">
              <span class="label">影厅</span>
              <span class="value">{{ order?.hall_name }}</span>
            </div>
            <div class="info-row">
              <span class="label">场次时间</span>
              <span class="value">{{ formatDateTime(order?.start_time) }}</span>
            </div>
            <div class="info-row">
              <span class="label">座位</span>
              <span class="value">{{ seatsText }}</span>
            </div>
            <div class="info-row">
              <span class="label">票价</span>
              <span class="value">¥{{ order?.ticket_price }} × {{ seats?.length }} 张</span>
            </div>
          </div>

          <div class="payment-total">
            <span class="label">应付金额</span>
            <span class="amount">¥{{ order?.total_amount }}</span>
          </div>

          <div class="countdown" v-if="countdown > 0">
            <span class="countdown-label">请在</span>
            <span class="countdown-time">{{ formatCountdown(countdown) }}</span>
            <span class="countdown-label">内完成支付</span>
          </div>
          <div class="countdown expired" v-else>
            <span class="countdown-label">订单已过期，请重新下单</span>
          </div>

          <div class="payment-methods">
            <h3>选择支付方式</h3>
            <div class="methods">
              <div 
                class="method-card" 
                :class="{ active: paymentMethod === 'wechat' }"
                @click="paymentMethod = 'wechat'"
              >
                <div class="method-icon">💚</div>
                <span>微信支付</span>
              </div>
              <div 
                class="method-card" 
                :class="{ active: paymentMethod === 'alipay' }"
                @click="paymentMethod = 'alipay'"
              >
                <div class="method-icon">💙</div>
                <span>支付宝</span>
              </div>
            </div>
          </div>

          <div class="payment-actions">
            <button class="btn btn-secondary" @click="cancelOrder" :disabled="processing">
              取消订单
            </button>
            <button 
              class="btn btn-primary btn-lg"
              :disabled="processing || countdown <= 0"
              @click="handlePayment"
            >
              <span v-if="processing">支付中...</span>
              <span v-else>立即支付 ¥{{ order?.total_amount }}</span>
            </button>
          </div>
          <p v-if="payError" class="pay-error" role="alert">{{ payError }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderDetail, payOrder, cancelOrder as cancelOrderApi } from '../../api/order'
import { useTicketStore } from '../../stores/ticket'
import { getRemainingSeconds } from '../../utils/orderStateMachine'
import { createPaymentSubmitter } from '../../utils/paymentSubmitter'
import { classifyApiError } from '../../utils/apiErrors'

const route = useRoute()
const router = useRouter()
const ticketStore = useTicketStore()

const order = ref(null)
const seats = ref([])
const loading = ref(true)
const error = ref('')
const processing = ref(false)
const paymentMethod = ref('wechat')
const countdown = ref(15 * 60)
const payError = ref('')

let countdownInterval = null

// 幂等支付提交器：重复点击只产生一次真实请求，已支付订单按成功处理
const paymentSubmitter = createPaymentSubmitter({ payApi: payOrder })

const seatsText = computed(() => {
  return seats.value
    .sort((a, b) => {
      if (a.row_number !== b.row_number) return a.row_number - b.row_number
      return a.col_number - b.col_number
    })
    .map(s => `${s.row_number}排${s.col_number}座`)
    .join('、')
})

const formatDateTime = (datetime) => {
  if (!datetime) return ''
  const parts = datetime.split(' ')
  return `${parts[0]} ${parts[1].substring(0, 5)}`
}

const formatCountdown = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const startCountdown = () => {
  countdownInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval)
    }
  }, 1000)
}

const loadOrder = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await ticketStore.getOrderDetailAction(route.params.orderNo)
    order.value = res.order
    seats.value = res.seats
    
    if (res.order.status !== 'pending') {
      router.push(`/order/${res.order.order_no}`)
      return
    }
    
    countdown.value = getRemainingSeconds(res.order)
    
    if (countdown.value > 0) {
      startCountdown()
    }
  } catch (err) {
    error.value = classifyApiError(err).message
  } finally {
    loading.value = false
  }
}

const handlePayment = async () => {
  if (countdown.value <= 0) {
    payError.value = '订单已过期，请重新下单'
    return
  }
  
  processing.value = true
  payError.value = ''
  try {
    await paymentSubmitter.submit(route.params.orderNo)
    router.push(`/order/${route.params.orderNo}`)
  } catch (err) {
    if (err && err.code === 'ORDER_EXPIRED') {
      countdown.value = 0
      payError.value = '订单已过期，座位锁定已释放，请重新下单'
    } else {
      payError.value = classifyApiError(err).message
    }
  } finally {
    processing.value = false
  }
}

const cancelOrder = async () => {
  if (!confirm('确定要取消订单吗？')) return
  
  processing.value = true
  try {
    await cancelOrderApi(route.params.orderNo)
    alert('订单已取消')
    router.push('/orders')
  } catch (err) {
    alert(err.message || '取消失败')
  } finally {
    processing.value = false
  }
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  loadOrder()
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})
</script>

<style scoped>
.payment-page {
  padding: 40px 0;
  min-height: 100vh;
}

.payment-card {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px;
}

.payment-header h1 {
  text-align: center;
  margin-bottom: 32px;
  color: #e0e0e0;
}

.order-info {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .label {
  color: #888;
}

.info-row .value {
  color: #e0e0e0;
  font-weight: 500;
}

.payment-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-top: 2px solid rgba(233, 69, 96, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 24px;
}

.payment-total .label {
  color: #888;
  font-size: 16px;
}

.payment-total .amount {
  font-size: 36px;
  font-weight: 700;
  color: #e94560;
}

.countdown {
  text-align: center;
  padding: 16px;
  background: rgba(233, 69, 96, 0.1);
  border-radius: 8px;
  margin-bottom: 24px;
}

.countdown.expired {
  background: rgba(255, 107, 107, 0.2);
}

.countdown-label {
  color: #aaa;
  font-size: 14px;
}

.countdown-time {
  font-size: 24px;
  font-weight: 700;
  color: #e94560;
  margin: 0 8px;
}

.countdown.expired .countdown-label {
  color: #ff6b6b;
}

.payment-methods h3 {
  margin-bottom: 16px;
  color: #e0e0e0;
  font-size: 16px;
}

.methods {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
}

.method-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.method-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.method-card.active {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.1);
}

.method-icon {
  font-size: 32px;
}

.payment-actions {
  display: flex;
  gap: 16px;
}

.payment-actions .btn {
  flex: 1;
}

.btn-lg {
  padding: 16px;
  font-size: 16px;
}

.error-section {
  text-align: center;
  padding: 40px;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-text {
  color: #ff6b6b;
  margin-bottom: 24px;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.pay-error {
  margin-top: 16px;
  text-align: center;
  color: #ff6b6b;
  font-size: 14px;
}
</style>

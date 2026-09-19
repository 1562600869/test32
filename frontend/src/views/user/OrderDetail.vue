<template>
  <div class="order-detail-page">
    <div class="container">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="error" class="error-section">
        <div class="error-icon">❌</div>
        <p class="error-text">{{ error }}</p>
        <button class="btn btn-primary" @click="router.push('/orders')">返回订单列表</button>
      </div>

      <div v-else class="order-card card">
        <div class="order-header">
          <div class="status-badge" :class="order?.status">
            {{ statusText }}
          </div>
          <h1>订单详情</h1>
        </div>

        <div class="movie-section">
          <img :src="order?.poster" :alt="order?.movie_title" class="movie-poster" />
          <div class="movie-info">
            <h2>{{ order?.movie_title }}</h2>
            <p class="cinema">{{ order?.cinema_name }}</p>
            <p class="hall">{{ order?.hall_name }}</p>
            <p class="time">
              <span>🕐 {{ formatDateTime(order?.start_time) }}</span>
              <span>~ {{ formatTime(order?.end_time) }}</span>
            </p>
          </div>
        </div>

        <div class="order-info">
          <div class="info-row">
            <span class="label">订单编号</span>
            <span class="value">{{ order?.order_no }}</span>
          </div>
          <div class="info-row">
            <span class="label">座位</span>
            <span class="value seats">{{ seatsText }}</span>
          </div>
          <div class="info-row">
            <span class="label">座位数量</span>
            <span class="value">{{ seats?.length }} 张</span>
          </div>
          <div class="info-row">
            <span class="label">单价</span>
            <span class="value">¥{{ order?.ticket_price }}</span>
          </div>
          <div class="info-row">
            <span class="label">实付金额</span>
            <span class="value amount">¥{{ order?.total_amount }}</span>
          </div>
          <div class="info-row">
            <span class="label">下单时间</span>
            <span class="value">{{ formatDateTime(order?.created_at) }}</span>
          </div>
          <div v-if="order?.paid_at" class="info-row">
            <span class="label">支付时间</span>
            <span class="value">{{ formatDateTime(order?.paid_at) }}</span>
          </div>
        </div>

        <div class="order-actions" v-if="order?.status === 'paid'">
          <button class="btn btn-secondary" @click="router.push('/')">继续购票</button>
          <button class="btn btn-primary" @click="router.push('/orders')">查看我的订单</button>
        </div>

        <div class="order-actions" v-else-if="order?.status === 'pending'">
          <button class="btn btn-secondary" @click="router.push('/orders')">返回订单列表</button>
          <button class="btn btn-primary" @click="goToPayment">继续支付</button>
        </div>

        <div class="order-actions" v-else>
          <button class="btn btn-primary" @click="router.push('/')">返回首页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderDetail } from '../../api/order'

const route = useRoute()
const router = useRouter()

const order = ref(null)
const seats = ref([])
const loading = ref(true)
const error = ref('')

const statusMap = {
  pending: { text: '待支付', class: 'pending' },
  paid: { text: '已支付', class: 'paid' },
  cancelled: { text: '已取消', class: 'cancelled' },
  expired: { text: '已过期', class: 'cancelled' },
  refunded: { text: '已退款', class: 'refunded' }
}

const statusText = computed(() => {
  return statusMap[order.value?.status]?.text || order.value?.status
})

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

const formatTime = (datetime) => {
  if (!datetime) return ''
  return datetime.split(' ')[1].substring(0, 5)
}

const loadOrder = async () => {
  loading.value = true
  try {
    const res = await getOrderDetail(route.params.orderNo)
    order.value = res.order
    seats.value = res.seats
  } catch (err) {
    error.value = err.message || '加载订单失败'
  } finally {
    loading.value = false
  }
}

const goToPayment = () => {
  router.push(`/payment/${order.value.order_no}`)
}

onMounted(() => {
  loadOrder()
})
</script>

<style scoped>
.order-detail-page {
  padding: 40px 0;
  min-height: 100vh;
}

.order-card {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px;
}

.order-header {
  text-align: center;
  margin-bottom: 32px;
}

.status-badge {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.status-badge.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-badge.paid {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
}

.status-badge.cancelled,
.status-badge.refunded {
  background: rgba(134, 142, 150, 0.2);
  color: #868e96;
}

.order-header h1 {
  color: #e0e0e0;
}

.movie-section {
  display: flex;
  gap: 24px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 24px;
}

.movie-poster {
  width: 120px;
  aspect-ratio: 3/4;
  object-fit: cover;
  border-radius: 8px;
}

.movie-info {
  flex: 1;
}

.movie-info h2 {
  font-size: 20px;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.movie-info .cinema {
  color: #e94560;
  font-weight: 500;
  margin-bottom: 4px;
}

.movie-info .hall {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 8px;
}

.movie-info .time {
  color: #888;
  font-size: 14px;
}

.movie-info .time span {
  margin-right: 16px;
}

.order-info {
  margin-bottom: 32px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 14px 0;
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

.info-row .value.seats {
  text-align: right;
  max-width: 60%;
  line-height: 1.5;
}

.info-row .value.amount {
  font-size: 20px;
  color: #e94560;
  font-weight: 700;
}

.order-actions {
  display: flex;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.order-actions .btn {
  flex: 1;
  padding: 14px;
}

.error-section {
  text-align: center;
  padding: 60px 20px;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-text {
  color: #ff6b6b;
  margin-bottom: 24px;
}
</style>

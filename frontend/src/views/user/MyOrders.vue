<template>
  <div class="my-orders-page">
    <div class="container">
      <div class="page-header">
        <h1>📋 我的订单</h1>
        <p>查看您的购票记录</p>
      </div>

      <div class="tab-buttons">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          全部
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'pending' }"
          @click="activeTab = 'pending'"
        >
          待支付
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'paid' }"
          @click="activeTab = 'paid'"
        >
          已支付
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'cancelled' }"
          @click="activeTab = 'cancelled'"
        >
          已取消
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'expired' }"
          @click="activeTab = 'expired'"
        >
          已过期
        </button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="filteredOrders.length === 0" class="empty-state">
        <div class="empty-icon">🎬</div>
        <p>暂无订单记录</p>
        <button class="btn btn-primary" @click="router.push('/')">去购票</button>
      </div>

      <div v-else class="orders-list">
        <div 
          v-for="order in filteredOrders" 
          :key="order.id"
          class="order-item card"
          @click="viewOrder(order)"
        >
          <div class="order-left">
            <img :src="order.poster" :alt="order.movie_title" class="movie-poster" />
          </div>
          <div class="order-middle">
            <h3 class="movie-title">{{ order.movie_title }}</h3>
            <p class="cinema">{{ order.cinema_name }} - {{ order.hall_name }}</p>
            <p class="time">🕐 {{ formatDateTime(order.start_time) }}</p>
            <p class="order-no">订单号：{{ order.order_no }}</p>
          </div>
          <div class="order-right">
            <span class="status-badge" :class="order.status">
              {{ statusMap[order.status]?.text || order.status }}
            </span>
            <span class="price">¥{{ order.total_amount }}</span>
            <div class="actions" @click.stop>
              <button 
                v-if="order.status === 'pending'" 
                class="btn btn-primary btn-sm"
                @click="goToPayment(order)"
              >
                去支付
              </button>
              <button 
                v-else
                class="btn btn-secondary btn-sm"
                @click="viewOrder(order)"
              >
                查看详情
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getOrders } from '../../api/order'

const router = useRouter()

const orders = ref([])
const loading = ref(true)
const activeTab = ref('all')

const statusMap = {
  pending: { text: '待支付', class: 'pending' },
  paid: { text: '已支付', class: 'paid' },
  cancelled: { text: '已取消', class: 'cancelled' },
  expired: { text: '已过期', class: 'expired' },
  refunded: { text: '已退款', class: 'refunded' }
}

const filteredOrders = computed(() => {
  if (activeTab.value === 'all') return orders.value
  return orders.value.filter(o => o.status === activeTab.value)
})

const formatDateTime = (datetime) => {
  if (!datetime) return ''
  const parts = datetime.split(' ')
  return `${parts[0]} ${parts[1].substring(0, 5)}`
}

const loadOrders = async () => {
  loading.value = true
  try {
    const res = await getOrders()
    orders.value = res.orders
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

const viewOrder = (order) => {
  router.push(`/order/${order.order_no}`)
}

const goToPayment = (order) => {
  router.push(`/payment/${order.order_no}`)
}

watch(activeTab, () => {
})

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.my-orders-page {
  padding-bottom: 60px;
  min-height: 100vh;
}

.tab-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tab-btn.active {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  color: white;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-item {
  display: flex;
  gap: 20px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.order-item:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.08);
}

.order-left {
  flex-shrink: 0;
}

.movie-poster {
  width: 90px;
  aspect-ratio: 3/4;
  object-fit: cover;
  border-radius: 8px;
}

.order-middle {
  flex: 1;
  min-width: 0;
}

.movie-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.cinema {
  color: #e94560;
  font-size: 14px;
  margin-bottom: 4px;
}

.time {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 4px;
}

.order-no {
  color: #666;
  font-size: 12px;
}

.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
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
.status-badge.expired,
.status-badge.refunded {
  background: rgba(134, 142, 150, 0.2);
  color: #868e96;
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: #e94560;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  color: #666;
  margin-bottom: 24px;
}
</style>

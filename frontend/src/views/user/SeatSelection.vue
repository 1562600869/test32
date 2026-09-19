<template>
  <div class="seat-selection">
    <div class="container">
      <div class="page-header">
        <h1>🎬 选择座位</h1>
        <p>{{ showtime?.movie_title }} - {{ showtime?.cinema_name }} - {{ showtime?.hall_name }}</p>
        <p class="showtime-info">{{ formatTime(showtime?.start_time) }} - {{ formatTime(showtime?.end_time) }}</p>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="loadError" class="error-state card" role="alert">
        <div class="error-icon">⚠️</div>
        <p class="error-message">{{ loadError.message }}</p>
        <button v-if="loadError.retryable" class="btn btn-primary" @click="loadData">
          重试
        </button>
        <button class="btn btn-secondary" @click="goBack">返回</button>
      </div>

      <div v-else-if="seats.length === 0" class="empty-state card">
        <div class="empty-icon">🪑</div>
        <p class="empty-message">该场次暂无可用座位信息</p>
        <button class="btn btn-primary" @click="loadData">重新加载</button>
      </div>

      <div v-else class="seat-container">
        <div class="screen">
          <div class="screen-label">银 幕</div>
        </div>

        <div class="seat-map-wrapper">
          <svg
            :viewBox="svgViewBox"
            class="seat-map"
            role="group"
            :aria-label="`座位图，共 ${rows.length} 排，已选 ${ticketStore.selectedSeats.length} 个座位`"
          >
            <g v-for="row in rows" :key="'row-' + row">
              <text 
                :x="labelX" 
                :y="getSeatY(row)" 
                class="row-label"
                text-anchor="end"
                dominant-baseline="middle"
              >
                {{ row }}排
              </text>
            </g>
            
            <g 
              v-for="seat in seats" 
              :key="seat.id"
              class="seat-group"
              :class="{ 'seat-disabled': seat.is_sold }"
              role="button"
              :tabindex="seat.is_sold ? -1 : 0"
              :aria-label="getSeatAriaLabel(seat)"
              :aria-pressed="ticketStore.isSeatSelected(seat.id)"
              :aria-disabled="seat.is_sold"
              @click="handleSeatClick(seat)"
              @keydown.enter.prevent="handleSeatClick(seat)"
              @keydown.space.prevent="handleSeatClick(seat)"
            >
              <rect
                :x="getSeatX(seat.col_number)"
                :y="getSeatY(seat.row_number)"
                :width="seatWidth"
                :height="seatHeight"
                :rx="4"
                :ry="4"
                :class="getSeatClass(seat)"
              />
              <text
                :x="getSeatX(seat.col_number) + seatWidth / 2"
                :y="getSeatY(seat.row_number) + seatHeight / 2"
                class="seat-number"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ seat.col_number }}
              </text>
            </g>
          </svg>
        </div>

        <div class="sr-only" aria-live="polite">
          已选 {{ ticketStore.selectedSeats.length }} 个座位{{ selectedSeatsText ? '：' + selectedSeatsText : '' }}
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-seat available"></div>
            <span>可选</span>
          </div>
          <div class="legend-item">
            <div class="legend-seat selected"></div>
            <span>已选</span>
          </div>
          <div class="legend-item">
            <div class="legend-seat sold"></div>
            <span>已售</span>
          </div>
          <div class="legend-item">
            <div class="legend-seat vip"></div>
            <span>VIP座</span>
          </div>
        </div>
      </div>

      <div v-if="orderError" class="order-error card" role="alert">
        <span class="order-error-icon">⚠️</span>
        <span class="order-error-text">{{ orderError }}</span>
        <button class="order-error-close" aria-label="关闭错误提示" @click="orderError = ''">×</button>
      </div>

      <div class="order-summary card">
        <div class="summary-content">
          <div class="summary-info">
            <div class="selected-seats">
              <span class="label">已选座位：</span>
              <span class="seats-list" v-if="ticketStore.selectedSeats.length > 0">
                {{ selectedSeatsText }}
              </span>
              <span class="empty-text" v-else>请选择座位</span>
            </div>
            <div class="seat-count">
              <span class="label">数量：</span>
              <span>{{ ticketStore.selectedSeats.length }} 张</span>
            </div>
          </div>
          <div class="summary-price">
            <span class="label">合计：</span>
            <span class="total-price">¥{{ ticketStore.totalAmount }}</span>
          </div>
          <button 
            class="btn btn-primary btn-lg"
            :disabled="ticketStore.selectedSeats.length === 0 || processing"
            @click="confirmOrder"
          >
            <span v-if="processing">处理中...</span>
            <span v-else>确认选座</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getShowtimeById } from '../../api/showtime'
import { useTicketStore } from '../../stores/ticket'
import { classifyApiError, formatSeatConflictMessage } from '../../utils/apiErrors'
import { markSeatsUnavailable, seatAriaLabel } from '../../utils/seatMap'

const route = useRoute()
const router = useRouter()
const ticketStore = useTicketStore()

const showtime = ref(null)
const seats = ref([])
const loading = ref(true)
const processing = ref(false)
const loadError = ref(null)
const orderError = ref('')

const seatWidth = 32
const seatHeight = 32
const seatGap = 8
const labelWidth = 60

const rows = computed(() => {
  if (seats.value.length === 0) return []
  const rowNumbers = [...new Set(seats.value.map(s => s.row_number))]
  return rowNumbers.sort((a, b) => a - b)
})

const cols = computed(() => {
  if (seats.value.length === 0) return []
  const colNumbers = [...new Set(seats.value.map(s => s.col_number))]
  return colNumbers.sort((a, b) => a - b)
})

const svgWidth = computed(() => {
  if (cols.value.length === 0) return 800
  return labelWidth + cols.value.length * (seatWidth + seatGap) + 40
})

const svgHeight = computed(() => {
  if (rows.value.length === 0) return 600
  return rows.value.length * (seatHeight + seatGap) + 40
})

const svgViewBox = computed(() => {
  return `0 0 ${svgWidth.value} ${svgHeight.value}`
})

const labelX = computed(() => labelWidth - 10)

const getSeatX = (col) => {
  return labelWidth + (col - 1) * (seatWidth + seatGap)
}

const getSeatY = (row) => {
  return 20 + (row - 1) * (seatHeight + seatGap)
}

const getSeatClass = (seat) => {
  const classes = ['seat']
  
  if (seat.is_sold) {
    classes.push('sold')
  } else if (ticketStore.isSeatSelected(seat.id)) {
    classes.push('selected')
    if (seat.seat_type === 'vip') classes.push('vip-selected')
  } else if (seat.seat_type === 'vip') {
    classes.push('vip')
  } else {
    classes.push('available')
  }
  
  return classes
}

const getSeatAriaLabel = (seat) => {
  return seatAriaLabel(seat, ticketStore.isSeatSelected(seat.id))
}

const selectedSeatsText = computed(() => {
  return ticketStore.selectedSeats
    .sort((a, b) => {
      if (a.row_number !== b.row_number) return a.row_number - b.row_number
      return a.col_number - b.col_number
    })
    .map(s => `${s.row_number}排${s.col_number}座`)
    .join('、')
})

const formatTime = (datetime) => {
  if (!datetime) return ''
  return datetime.split(' ')[1].substring(0, 5)
}

const handleSeatClick = (seat) => {
  if (seat.is_sold) return
  orderError.value = ''
  ticketStore.toggleSeat(seat)
}

const confirmOrder = async () => {
  if (ticketStore.selectedSeats.length === 0) return
  
  processing.value = true
  orderError.value = ''
  try {
    const order = await ticketStore.createOrderAction()
    router.push(`/payment/${order.order_no}`)
  } catch (error) {
    if (error && error.code === 'SEAT_CONFLICT') {
      // 冲突座位立即在本地置为不可选、移出已选，再以服务端数据为准刷新
      const conflictSeats = error.conflict_seats || []
      seats.value = markSeatsUnavailable(seats.value, conflictSeats)
      ticketStore.removeConflictedSeats(conflictSeats)
      orderError.value = formatSeatConflictMessage(error)
      refreshSeats()
    } else {
      orderError.value = classifyApiError(error).message
    }
  } finally {
    processing.value = false
  }
}

// 静默刷新座位图（以服务端为准），不改变页面加载态
const refreshSeats = async () => {
  try {
    const res = await getShowtimeById(route.params.id)
    showtime.value = res.showtime
    seats.value = res.seats
  } catch (error) {
    // 静默刷新失败不覆盖当前页面，只记录
    console.warn('座位图刷新失败:', error)
  }
}

const loadData = async () => {
  loading.value = true
  loadError.value = null
  try {
    const res = await getShowtimeById(route.params.id)
    showtime.value = res.showtime
    seats.value = res.seats
    ticketStore.setShowtime(res.showtime)
  } catch (error) {
    loadError.value = classifyApiError(error)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

// 跨标签页规则：以服务端为准。页面重新可见时静默刷新座位图，
// 另一标签页的锁定/购票结果会反映到当前座位图。
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && !loading.value && !loadError.value) {
    refreshSeats()
  }
}

onMounted(() => {
  ticketStore.clearSelection()
  loadData()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  ticketStore.clearSelection()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.seat-selection {
  padding-bottom: 40px;
}

.showtime-info {
  color: #888 !important;
  margin-top: 8px;
}

.seat-container {
  max-width: 900px;
  margin: 0 auto;
}

.screen {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.screen-label {
  width: 60%;
  height: 40px;
  background: linear-gradient(180deg, #e94560 0%, rgba(233, 69, 96, 0.3) 100%);
  border-radius: 0 0 50% 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  letter-spacing: 20px;
  text-align: center;
  text-indent: 20px;
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.3);
}

.seat-map-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  overflow-x: auto;
  padding-bottom: 20px;
}

.seat-map {
  width: 100%;
  max-width: 800px;
  height: auto;
}

.row-label {
  fill: #888;
  font-size: 12px;
}

.seat-group {
  cursor: pointer;
}

.seat-group.seat-disabled {
  cursor: not-allowed;
}

.seat-group:focus-visible {
  outline: 2px solid #e94560;
  outline-offset: 2px;
  border-radius: 4px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.error-state,
.empty-state {
  max-width: 480px;
  margin: 40px auto;
  padding: 48px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.error-icon,
.empty-icon {
  font-size: 48px;
}

.error-message {
  color: #ff6b6b;
  font-size: 15px;
}

.empty-message {
  color: #888;
  font-size: 15px;
}

.order-error {
  max-width: 900px;
  margin: 0 auto 16px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 107, 107, 0.4);
  background: rgba(255, 107, 107, 0.08);
}

.order-error-text {
  flex: 1;
  color: #ff6b6b;
  font-size: 14px;
}

.order-error-close {
  background: none;
  border: none;
  color: #ff6b6b;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
}

.seat {
  transition: all 0.2s ease;
}

.seat.available {
  fill: #3d405b;
  stroke: #4a4e69;
  stroke-width: 1;
}

.seat-group:hover .seat.available {
  fill: #4a4e69;
  transform: scale(1.05);
}

.seat.vip {
  fill: #4a3728;
  stroke: #8b7355;
}

.seat.selected {
  fill: #e94560;
  stroke: #ff6b6b;
}

.seat.vip-selected {
  fill: #d4a574;
  stroke: #f4d03f;
}

.seat.sold {
  fill: #1a1a2e;
  stroke: #2d2d44;
  cursor: not-allowed;
  opacity: 0.5;
}

.seat-number {
  font-size: 11px;
  fill: #e0e0e0;
  pointer-events: none;
  user-select: none;
}

.legend {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 40px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #888;
}

.legend-seat {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.legend-seat.available {
  background: #3d405b;
  border: 1px solid #4a4e69;
}

.legend-seat.selected {
  background: #e94560;
}

.legend-seat.sold {
  background: #1a1a2e;
  border: 1px solid #2d2d44;
  opacity: 0.5;
}

.legend-seat.vip {
  background: #4a3728;
  border: 1px solid #8b7355;
}

.order-summary {
  position: sticky;
  bottom: 20px;
  padding: 20px;
}

.summary-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.summary-info {
  flex: 1;
}

.selected-seats {
  margin-bottom: 8px;
}

.selected-seats .label,
.seat-count .label {
  color: #888;
  font-size: 13px;
}

.seats-list {
  color: #e0e0e0;
  font-weight: 500;
}

.empty-text {
  color: #666;
}

.seat-count span {
  color: #e0e0e0;
}

.summary-price {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-price .label {
  color: #888;
}

.total-price {
  font-size: 28px;
  font-weight: 700;
  color: #e94560;
}

.btn-lg {
  padding: 14px 40px;
  font-size: 16px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

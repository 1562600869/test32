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

      <div v-else class="seat-container">
        <div class="screen">
          <div class="screen-label">银 幕</div>
        </div>

        <div class="seat-map-wrapper">
          <svg :viewBox="svgViewBox" class="seat-map">
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
              @click="handleSeatClick(seat)"
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

const route = useRoute()
const router = useRouter()
const ticketStore = useTicketStore()

const showtime = ref(null)
const seats = ref([])
const loading = ref(true)
const processing = ref(false)

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
  ticketStore.toggleSeat(seat)
}

const confirmOrder = async () => {
  if (ticketStore.selectedSeats.length === 0) return
  
  processing.value = true
  try {
    const order = await ticketStore.createOrderAction()
    router.push(`/payment/${order.order_no}`)
  } catch (error) {
    alert(error.message || '创建订单失败，请重试')
    console.error(error)
  } finally {
    processing.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getShowtimeById(route.params.id)
    showtime.value = res.showtime
    seats.value = res.seats
    ticketStore.setShowtime(res.showtime)
  } catch (error) {
    console.error('加载数据失败:', error)
    alert('加载数据失败，请重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  ticketStore.clearSelection()
  loadData()
})

onUnmounted(() => {
  ticketStore.clearSelection()
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

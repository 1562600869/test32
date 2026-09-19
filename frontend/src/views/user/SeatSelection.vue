<template>
  <div class="seat-selection">
    <div class="container">
      <div class="page-header">
        <h1>🎬 选择座位</h1>
        <p>{{ showtime?.movie_title }} - {{ showtime?.cinema_name }} - {{ showtime?.hall_name }}</p>
        <p class="showtime-info">{{ formatTime(showtime?.start_time) }} - {{ formatTime(showtime?.end_time) }}</p>
      </div>

      <div v-if="viewState.type === 'loading'" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="viewState.type === 'error'" class="error-state" role="alert">
        <div class="error-icon">⚠️</div>
        <p class="error-text">{{ viewState.message }}</p>
        <button class="btn btn-primary" @click="loadData">重试</button>
      </div>

      <div v-else-if="viewState.type === 'empty'" class="empty-state">
        <div class="empty-icon">💺</div>
        <p class="empty-text">该场次暂无可售座位</p>
        <button class="btn btn-secondary" @click="loadData">刷新</button>
      </div>

      <div v-else class="seat-container">
        <div
          v-if="conflictError"
          class="conflict-banner"
          role="alert"
        >
          <span>{{ conflictError }}</span>
          <button class="btn btn-secondary btn-sm" @click="dismissConflict">知道了</button>
        </div>

        <div class="screen">
          <div class="screen-label">银 幕</div>
        </div>

        <div class="seat-map-wrapper">
          <svg
            :viewBox="svgViewBox"
            class="seat-map"
            role="group"
            aria-label="座位图，使用方向键上方格键或回车选择座位"
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
              :class="{ disabled: seat.is_sold }"
              :tabindex="seat.is_sold ? -1 : 0"
              role="checkbox"
              :aria-checked="ticketStore.isSeatSelected(seat.id)"
              :aria-disabled="seat.is_sold"
              :aria-label="getSeatAriaLabel(seat)"
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
                aria-hidden="true"
              >
                {{ seat.col_number }}
              </text>
            </g>
          </svg>
        </div>

        <div class="legend" aria-hidden="true">
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

      <div class="order-summary card" v-if="viewState.type === 'ready'">
        <div class="summary-content">
          <div class="summary-info">
            <div class="selected-seats">
              <span class="label">已选座位：</span>
              <span class="seats-list" v-if="ticketStore.selectedSeats.length > 0">
                {{ selectedSeatsText }}
              </span>
              <span class="empty-text" v-else>请选择座位</span>
            </div>
            <div class="seat-count" aria-live="polite" role="status">
              <span class="label">数量：</span>
              <span>{{ selectionSummaryText }}</span>
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
import { SeatConflictError, describeError } from '../../utils/errors'
import { resolveViewState } from '../../utils/uiState'
import {
  seatState,
  seatAriaLabel,
  selectionSummary,
  removeConflictSeats,
  reconcileSelection
} from '../../utils/seatMap'

const route = useRoute()
const router = useRouter()
const ticketStore = useTicketStore()

const showtime = ref(null)
const seats = ref([])
const loading = ref(true)
const loadError = ref(null)
const conflictError = ref('')
const processing = ref(false)

const seatWidth = 32
const seatHeight = 32
const seatGap = 8
const labelWidth = 60

const viewState = computed(() =>
  resolveViewState({ loading: loading.value, error: loadError.value, data: seats.value })
)

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
  const state = seatState(seat, ticketStore.isSeatSelected(seat.id))
  classes.push(state)
  if (state === 'selected' && seat.seat_type === 'vip') classes.push('vip-selected')
  if (state === 'available' && seat.seat_type === 'vip') classes.push('vip')
  return classes
}

const getSeatAriaLabel = (seat) => {
  return seatAriaLabel(seat, seatState(seat, ticketStore.isSeatSelected(seat.id)))
}

const selectionSummaryText = computed(() => selectionSummary(ticketStore.selectedSeats.length))

const selectedSeatsText = computed(() => {
  return ticketStore.selectedSeats
    .slice()
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
  conflictError.value = ''
  ticketStore.toggleSeat(seat)
}

const dismissConflict = () => {
  conflictError.value = ''
}

const confirmOrder = async () => {
  if (ticketStore.selectedSeats.length === 0) return
  
  processing.value = true
  conflictError.value = ''
  try {
    const order = await ticketStore.createOrderAction()
    router.push(`/payment/${order.order_no}`)
  } catch (error) {
    if (error instanceof SeatConflictError) {
      // 409 冲突：展示含场次 ID 与座位坐标的诊断信息，
      // 移除冲突座位并刷新座位图，回到服务端真实状态
      conflictError.value = describeError(error)
      ticketStore.selectedSeats = removeConflictSeats(
        ticketStore.selectedSeats,
        error.seats
      )
      await loadData({ silent: true })
    } else {
      conflictError.value = `${error.message || '创建订单失败'}（可重试）`
    }
  } finally {
    processing.value = false
  }
}

const loadData = async ({ silent = false } = {}) => {
  if (!silent) {
    loading.value = true
    loadError.value = null
  }
  try {
    const res = await getShowtimeById(route.params.id)
    showtime.value = res.showtime
    seats.value = res.seats
    ticketStore.setShowtime(res.showtime, { keepSelection: true })
    // 以服务端为准重算本地已选：已售/被锁座位从本地已选中剔除
    ticketStore.selectedSeats = reconcileSelection(ticketStore.selectedSeats, res.seats)
    loadError.value = null
  } catch (error) {
    if (silent) {
      conflictError.value = conflictError.value || `刷新座位图失败：${error.message}`
    } else {
      loadError.value = error
    }
  } finally {
    loading.value = false
  }
}

// 跨标签页规则：已选状态以服务端为准。窗口重新聚焦时刷新座位图，
// 其他标签页的锁定/出票会反映到本页；本地未提交的"已选"不覆盖服务端。
const handleWindowFocus = () => {
  if (viewState.value.type !== 'loading') {
    loadData({ silent: true })
  }
}

onMounted(() => {
  ticketStore.clearSelection()
  loadData()
  window.addEventListener('focus', handleWindowFocus)
})

onUnmounted(() => {
  ticketStore.clearSelection()
  window.removeEventListener('focus', handleWindowFocus)
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

.error-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.error-icon,
.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.error-text {
  color: #ff6b6b;
  margin-bottom: 24px;
}

.empty-text {
  color: #888;
  margin-bottom: 24px;
}

.conflict-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  margin-bottom: 20px;
  background: rgba(255, 107, 107, 0.12);
  border: 1px solid rgba(255, 107, 107, 0.4);
  border-radius: 8px;
  color: #ffb3b3;
  font-size: 14px;
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
  outline: none;
}

.seat-group:focus-visible .seat {
  stroke: #ffffff;
  stroke-width: 2;
}

.seat-group.disabled {
  cursor: not-allowed;
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

.seat.sold,
.seat.locked {
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

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createOrder, payOrder, getOrderDetail } from '../api/order'

export const useTicketStore = defineStore('ticket', () => {
  const selectedMovie = ref(null)
  const selectedShowtime = ref(null)
  const selectedSeats = ref([])
  const currentOrder = ref(null)

  const totalAmount = computed(() => {
    if (!selectedShowtime.value) return 0
    return selectedShowtime.value.ticket_price * selectedSeats.value.length
  })

  const setMovie = (movie) => {
    selectedMovie.value = movie
    selectedShowtime.value = null
    selectedSeats.value = []
  }

  const setShowtime = (showtime) => {
    selectedShowtime.value = showtime
    selectedSeats.value = []
  }

  const toggleSeat = (seat) => {
    const index = selectedSeats.value.findIndex(s => s.id === seat.id)
    if (index > -1) {
      selectedSeats.value.splice(index, 1)
    } else {
      selectedSeats.value.push(seat)
    }
  }

  const isSeatSelected = (seatId) => {
    return selectedSeats.value.some(s => s.id === seatId)
  }

  const clearSelection = () => {
    selectedSeats.value = []
  }

  const createOrderAction = async () => {
    if (!selectedShowtime.value || selectedSeats.value.length === 0) {
      throw new Error('请选择场次和座位')
    }

    const res = await createOrder({
      showtime_id: selectedShowtime.value.id,
      seat_ids: selectedSeats.value.map(s => s.id)
    })
    currentOrder.value = res.order
    return res.order
  }

  const payOrderAction = async (orderNo) => {
    const res = await payOrder(orderNo)
    return res
  }

  const getOrderDetailAction = async (orderNo) => {
    const res = await getOrderDetail(orderNo)
    return res
  }

  const resetAll = () => {
    selectedMovie.value = null
    selectedShowtime.value = null
    selectedSeats.value = []
    currentOrder.value = null
  }

  return {
    selectedMovie,
    selectedShowtime,
    selectedSeats,
    currentOrder,
    totalAmount,
    setMovie,
    setShowtime,
    toggleSeat,
    isSeatSelected,
    clearSelection,
    createOrderAction,
    payOrderAction,
    getOrderDetailAction,
    resetAll
  }
})

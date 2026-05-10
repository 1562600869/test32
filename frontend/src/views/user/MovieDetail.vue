<template>
  <div class="movie-detail" v-if="movie">
    <div class="movie-hero">
      <div class="container hero-content">
        <div class="movie-poster-large">
          <img :src="movie.poster" :alt="movie.title" />
        </div>
        <div class="movie-details">
          <h1>{{ movie.title }}</h1>
          <div class="movie-meta">
            <span v-if="movie.rating > 0" class="rating">⭐ {{ movie.rating }} 分</span>
            <span class="genre">{{ movie.genre }}</span>
            <span class="duration">🕐 {{ movie.duration }} 分钟</span>
            <span class="release-date">📅 {{ movie.release_date }}</span>
          </div>
          <p class="movie-desc">{{ movie.description }}</p>
        </div>
      </div>
    </div>

    <div class="container">
      <div class="showtimes-section">
        <h2>🎬 选择场次</h2>
        
        <div v-if="loadingShowtimes" class="loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="showtimes.length === 0" class="empty-state">
          <p>暂无场次安排</p>
        </div>

        <div v-else class="showtimes-list">
          <div 
            v-for="showtime in showtimes" 
            :key="showtime.id"
            class="showtime-card card"
            @click="selectShowtime(showtime)"
          >
            <div class="showtime-time">
              <span class="time">{{ formatTime(showtime.start_time) }}</span>
              <span class="date">{{ formatDate(showtime.start_time) }}</span>
            </div>
            <div class="showtime-info">
              <div class="cinema-name">{{ showtime.cinema_name }}</div>
              <div class="hall-name">{{ showtime.hall_name }}</div>
            </div>
            <div class="showtime-price">
              <span class="price">¥{{ showtime.ticket_price }}</span>
              <button class="btn btn-primary btn-sm">选座购票</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMovieById } from '../../api/movie'
import { getShowtimes } from '../../api/showtime'
import { useTicketStore } from '../../stores/ticket'

const route = useRoute()
const router = useRouter()
const ticketStore = useTicketStore()

const movie = ref(null)
const showtimes = ref([])
const loadingShowtimes = ref(false)

const formatTime = (datetime) => {
  return datetime.split(' ')[1].substring(0, 5)
}

const formatDate = (datetime) => {
  const date = new Date(datetime)
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekDays[date.getDay()]}`
}

const selectShowtime = (showtime) => {
  ticketStore.setShowtime(showtime)
  router.push(`/showtime/${showtime.id}`)
}

const loadData = async () => {
  const movieId = route.params.id
  
  try {
    const [movieRes, showtimesRes] = await Promise.all([
      getMovieById(movieId),
      getShowtimes({ movie_id: movieId })
    ])
    
    movie.value = movieRes.movie
    showtimes.value = showtimesRes.showtimes
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.movie-detail {
  padding-bottom: 60px;
}

.movie-hero {
  background: linear-gradient(180deg, rgba(233, 69, 96, 0.1) 0%, transparent 100%);
  padding: 40px 0;
  margin-bottom: 40px;
}

.hero-content {
  display: flex;
  gap: 40px;
  align-items: flex-start;
}

.movie-poster-large {
  width: 280px;
  flex-shrink: 0;
}

.movie-poster-large img {
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.movie-details {
  flex: 1;
}

.movie-details h1 {
  font-size: 36px;
  margin-bottom: 16px;
  color: #e0e0e0;
}

.movie-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.movie-meta span {
  color: #aaa;
  font-size: 14px;
}

.movie-meta .rating {
  color: #ffd700;
  font-weight: 600;
  font-size: 18px;
}

.movie-desc {
  font-size: 15px;
  line-height: 1.8;
  color: #bbb;
}

.showtimes-section h2 {
  margin-bottom: 24px;
  color: #e0e0e0;
}

.showtimes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.showtime-card {
  display: flex;
  align-items: center;
  padding: 20px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.showtime-card:hover {
  transform: translateX(8px);
  background: rgba(255, 255, 255, 0.08);
}

.showtime-time {
  width: 120px;
  text-align: center;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding-right: 24px;
}

.showtime-time .time {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #e94560;
}

.showtime-time .date {
  font-size: 13px;
  color: #888;
}

.showtime-info {
  flex: 1;
  padding: 0 24px;
}

.cinema-name {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.hall-name {
  font-size: 14px;
  color: #888;
}

.showtime-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.showtime-price .price {
  font-size: 24px;
  font-weight: 700;
  color: #e94560;
}

.btn-sm {
  padding: 8px 20px;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #666;
}
</style>

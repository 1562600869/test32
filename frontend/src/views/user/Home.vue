<template>
  <div class="home-page">
    <div class="page-header">
      <h1>🎬 热门电影</h1>
      <p>选择心仪的电影，开启观影之旅</p>
    </div>
    
    <div class="container">
      <div class="tab-buttons">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'showing' }"
          @click="activeTab = 'showing'"
        >
          正在热映
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'coming_soon' }"
          @click="activeTab = 'coming_soon'"
        >
          即将上映
        </button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="movies.length === 0" class="empty-state">
        <p>暂无电影数据</p>
      </div>

      <div v-else class="movies-grid">
        <div 
          v-for="movie in movies" 
          :key="movie.id" 
          class="movie-card card"
          @click="goToDetail(movie)"
        >
          <div class="movie-poster">
            <img :src="movie.poster" :alt="movie.title" />
            <div class="movie-overlay">
              <span class="play-icon">▶</span>
            </div>
          </div>
          <div class="movie-info">
            <h3 class="movie-title">{{ movie.title }}</h3>
            <div class="movie-meta">
              <span class="rating" v-if="movie.rating > 0">⭐ {{ movie.rating }}</span>
              <span class="genre">{{ movie.genre }}</span>
            </div>
            <p class="movie-desc">{{ movie.description.substring(0, 50) }}...</p>
            <div class="movie-footer">
              <span class="duration">🕐 {{ movie.duration }}分钟</span>
              <button class="btn btn-primary btn-sm" @click.stop="goToDetail(movie)">
                {{ activeTab === 'showing' ? '购票' : '想看' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMovies } from '../../api/movie'
import { useTicketStore } from '../../stores/ticket'

const router = useRouter()
const ticketStore = useTicketStore()

const activeTab = ref('showing')
const movies = ref([])
const loading = ref(false)

const loadMovies = async () => {
  loading.value = true
  try {
    const res = await getMovies({ status: activeTab.value })
    movies.value = res.movies
  } catch (error) {
    console.error('加载电影失败:', error)
  } finally {
    loading.value = false
  }
}

const goToDetail = (movie) => {
  ticketStore.setMovie(movie)
  router.push(`/movie/${movie.id}`)
}

watch(activeTab, () => {
  loadMovies()
})

onMounted(() => {
  loadMovies()
})
</script>

<style scoped>
.home-page {
  padding-bottom: 60px;
}

.tab-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
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

.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

.movie-card {
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.movie-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(233, 69, 96, 0.2);
}

.movie-poster {
  position: relative;
  aspect-ratio: 3/4;
  overflow: hidden;
}

.movie-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.movie-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.movie-card:hover .movie-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 48px;
  color: white;
}

.movie-info {
  padding: 16px;
}

.movie-title {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.movie-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.rating {
  color: #ffd700;
  font-weight: 600;
}

.genre {
  color: #888;
  font-size: 13px;
}

.movie-desc {
  font-size: 13px;
  color: #888;
  line-height: 1.5;
  margin-bottom: 12px;
}

.movie-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.duration {
  color: #888;
  font-size: 13px;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #666;
}
</style>

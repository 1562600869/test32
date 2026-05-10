<template>
  <div class="admin-showtimes">
    <div class="page-header">
      <h1>📅 场次管理</h1>
      <button class="btn btn-primary" @click="openModal()">+ 新增场次</button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="showtimes-table-wrapper card">
      <table class="showtimes-table">
        <thead>
          <tr>
            <th>电影</th>
            <th>影院</th>
            <th>影厅</th>
            <th>开始时间</th>
            <th>结束时间</th>
            <th>票价</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="showtime in showtimes" :key="showtime.id">
            <td class="movie-name">{{ showtime.movie_title }}</td>
            <td>{{ showtime.cinema_name }}</td>
            <td>{{ showtime.hall_name }}</td>
            <td>{{ formatDateTime(showtime.start_time) }}</td>
            <td>{{ formatTime(showtime.end_time) }}</td>
            <td class="price">¥{{ showtime.ticket_price }}</td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" @click="openModal(showtime)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="deleteShowtime(showtime)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal card">
        <h2>{{ editingShowtime ? '编辑场次' : '新增场次' }}</h2>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>电影</label>
            <select v-model="form.movie_id" class="form-input" required>
              <option value="">请选择电影</option>
              <option v-for="movie in movies" :key="movie.id" :value="movie.id">
                {{ movie.title }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>影院</label>
            <select v-model="selectedCinema" class="form-input" @change="loadHalls" required>
              <option value="">请选择影院</option>
              <option v-for="cinema in cinemas" :key="cinema.id" :value="cinema.id">
                {{ cinema.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>影厅</label>
            <select v-model="form.hall_id" class="form-input" required>
              <option value="">请选择影厅</option>
              <option v-for="hall in halls" :key="hall.id" :value="hall.id">
                {{ hall.name }} ({{ hall.rows_count }}行 × {{ hall.cols_count }}列)
              </option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始时间</label>
              <input type="datetime-local" v-model="form.start_time" class="form-input" required />
            </div>
            <div class="form-group">
              <label>结束时间</label>
              <input type="datetime-local" v-model="form.end_time" class="form-input" required />
            </div>
          </div>
          <div class="form-group">
            <label>票价(元)</label>
            <input type="number" v-model="form.ticket_price" class="form-input" step="0.01" required />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getShowtimes, createShowtime, updateShowtime, deleteShowtime as deleteShowtimeApi } from '../../api/showtime'
import { getMovies } from '../../api/movie'
import { getCinemas, getHallsByCinema } from '../../api/cinema'

const showtimes = ref([])
const movies = ref([])
const cinemas = ref([])
const halls = ref([])
const loading = ref(true)
const showModal = ref(false)
const editingShowtime = ref(null)
const selectedCinema = ref('')
const submitting = ref(false)

const form = ref({
  movie_id: '',
  hall_id: '',
  start_time: '',
  end_time: '',
  ticket_price: ''
})

const formatDateTime = (datetime) => {
  const parts = datetime.split(' ')
  return `${parts[0]} ${parts[1].substring(0, 5)}`
}

const formatTime = (datetime) => {
  return datetime.split(' ')[1].substring(0, 5)
}

const loadData = async () => {
  loading.value = true
  try {
    const [showtimesRes, moviesRes, cinemasRes] = await Promise.all([
      getShowtimes(),
      getMovies(),
      getCinemas()
    ])
    showtimes.value = showtimesRes.showtimes
    movies.value = moviesRes.movies
    cinemas.value = cinemasRes.cinemas
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

const loadHalls = async () => {
  if (!selectedCinema.value) {
    halls.value = []
    return
  }
  try {
    const res = await getHallsByCinema(selectedCinema.value)
    halls.value = res.halls
  } catch (error) {
    console.error('加载影厅失败:', error)
  }
}

const openModal = (showtime = null) => {
  editingShowtime.value = showtime
  if (showtime) {
    form.value = {
      movie_id: showtime.movie_id,
      hall_id: showtime.hall_id,
      start_time: showtime.start_time.replace(' ', 'T'),
      end_time: showtime.end_time.replace(' ', 'T'),
      ticket_price: showtime.ticket_price
    }
  } else {
    form.value = {
      movie_id: '',
      hall_id: '',
      start_time: '',
      end_time: '',
      ticket_price: ''
    }
    selectedCinema.value = ''
    halls.value = []
  }
  showModal.value = true
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    const data = {
      ...form.value,
      start_time: form.value.start_time.replace('T', ' '),
      end_time: form.value.end_time.replace('T', ' ')
    }
    
    if (editingShowtime.value) {
      await updateShowtime(editingShowtime.value.id, data)
      alert('更新成功')
    } else {
      await createShowtime(data)
      alert('创建成功')
    }
    showModal.value = false
    loadData()
  } catch (error) {
    alert(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const deleteShowtime = async (showtime) => {
  if (!confirm(`确定要删除该场次吗？`)) return
  
  try {
    await deleteShowtimeApi(showtime.id)
    alert('删除成功')
    loadData()
  } catch (error) {
    alert(error.message || '删除失败')
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.admin-showtimes {
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #e0e0e0;
}

.showtimes-table-wrapper {
  overflow-x: auto;
}

.showtimes-table {
  width: 100%;
  border-collapse: collapse;
}

.showtimes-table th,
.showtimes-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.showtimes-table th {
  color: #888;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
}

.movie-name {
  font-weight: 600;
  color: #e0e0e0;
}

.price {
  color: #e94560;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-danger {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.btn-danger:hover {
  background: rgba(255, 107, 107, 0.3);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 32px;
}

.modal h2 {
  margin-bottom: 24px;
  color: #e0e0e0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>

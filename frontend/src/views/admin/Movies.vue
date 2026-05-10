<template>
  <div class="admin-movies">
    <div class="page-header">
      <h1>🎥 影片管理</h1>
      <button class="btn btn-primary" @click="openModal()">+ 新增影片</button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="movies-table-wrapper card">
      <table class="movies-table">
        <thead>
          <tr>
            <th>海报</th>
            <th>片名</th>
            <th>类型</th>
            <th>时长</th>
            <th>上映日期</th>
            <th>评分</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="movie in movies" :key="movie.id">
            <td>
              <img :src="movie.poster" :alt="movie.title" class="poster-thumb" />
            </td>
            <td class="movie-title">{{ movie.title }}</td>
            <td>{{ movie.genre }}</td>
            <td>{{ movie.duration }}分钟</td>
            <td>{{ movie.release_date }}</td>
            <td>{{ movie.rating }}</td>
            <td>
              <span class="status-badge" :class="movie.status">
                {{ statusMap[movie.status] }}
              </span>
            </td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" @click="openModal(movie)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="deleteMovie(movie)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal card">
        <h2>{{ editingMovie ? '编辑影片' : '新增影片' }}</h2>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>片名</label>
            <input type="text" v-model="form.title" class="form-input" required />
          </div>
          <div class="form-group">
            <label>海报URL</label>
            <input type="text" v-model="form.poster" class="form-input" required />
          </div>
          <div class="form-group">
            <label>简介</label>
            <textarea v-model="form.description" class="form-input" rows="3" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>类型</label>
              <input type="text" v-model="form.genre" class="form-input" required />
            </div>
            <div class="form-group">
              <label>时长(分钟)</label>
              <input type="number" v-model="form.duration" class="form-input" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>上映日期</label>
              <input type="date" v-model="form.release_date" class="form-input" required />
            </div>
            <div class="form-group">
              <label>评分</label>
              <input type="number" v-model="form.rating" class="form-input" step="0.1" min="0" max="10" />
            </div>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-input">
              <option value="showing">正在热映</option>
              <option value="coming_soon">即将上映</option>
              <option value="ended">已下架</option>
            </select>
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
import { getMovies, createMovie, updateMovie, deleteMovie as deleteMovieApi } from '../../api/movie'

const movies = ref([])
const loading = ref(true)
const showModal = ref(false)
const editingMovie = ref(null)
const submitting = ref(false)

const statusMap = {
  showing: '正在热映',
  coming_soon: '即将上映',
  ended: '已下架'
}

const form = ref({
  title: '',
  poster: '',
  description: '',
  duration: '',
  genre: '',
  release_date: '',
  rating: 0,
  status: 'showing'
})

const loadMovies = async () => {
  loading.value = true
  try {
    const res = await getMovies()
    movies.value = res.movies
  } catch (error) {
    console.error('加载电影失败:', error)
  } finally {
    loading.value = false
  }
}

const openModal = (movie = null) => {
  editingMovie.value = movie
  if (movie) {
    form.value = { ...movie }
  } else {
    form.value = {
      title: '',
      poster: '',
      description: '',
      duration: '',
      genre: '',
      release_date: '',
      rating: 0,
      status: 'showing'
    }
  }
  showModal.value = true
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    if (editingMovie.value) {
      await updateMovie(editingMovie.value.id, form.value)
      alert('更新成功')
    } else {
      await createMovie(form.value)
      alert('创建成功')
    }
    showModal.value = false
    loadMovies()
  } catch (error) {
    alert(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const deleteMovie = async (movie) => {
  if (!confirm(`确定要删除《${movie.title}》吗？`)) return
  
  try {
    await deleteMovieApi(movie.id)
    alert('删除成功')
    loadMovies()
  } catch (error) {
    alert(error.message || '删除失败')
  }
}

onMounted(() => {
  loadMovies()
})
</script>

<style scoped>
.admin-movies {
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

.movies-table-wrapper {
  overflow-x: auto;
}

.movies-table {
  width: 100%;
  border-collapse: collapse;
}

.movies-table th,
.movies-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.movies-table th {
  color: #888;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
}

.poster-thumb {
  width: 50px;
  height: 70px;
  object-fit: cover;
  border-radius: 4px;
}

.movie-title {
  font-weight: 600;
  color: #e0e0e0;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.status-badge.showing {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
}

.status-badge.coming_soon {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-badge.ended {
  background: rgba(134, 142, 150, 0.2);
  color: #868e96;
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
  max-width: 500px;
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

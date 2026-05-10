<template>
  <div class="admin-cinemas">
    <div class="page-header">
      <h1>🏢 影院管理</h1>
      <button class="btn btn-primary" @click="openCinemaModal()">+ 新增影院</button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="cinemas-list">
      <div v-for="cinema in cinemas" :key="cinema.id" class="cinema-card card">
        <div class="cinema-header">
          <div>
            <h3 class="cinema-name">{{ cinema.name }}</h3>
            <p class="cinema-location">📍 {{ cinema.location }}</p>
          </div>
          <div class="cinema-actions">
            <button class="btn btn-primary btn-sm" @click="openHallModal(cinema)">+ 新增影厅</button>
            <button class="btn btn-danger btn-sm" @click="deleteCinema(cinema)">删除</button>
          </div>
        </div>
        
        <div class="halls-section" v-if="cinemaHalls[cinema.id]?.length > 0">
          <h4>影厅列表</h4>
          <div class="halls-grid">
            <div v-for="hall in cinemaHalls[cinema.id]" :key="hall.id" class="hall-card">
              <div class="hall-name">{{ hall.name }}</div>
              <div class="hall-info">{{ hall.rows_count }} 行 × {{ hall.cols_count }} 列</div>
              <div class="hall-seats">{{ hall.rows_count * hall.cols_count }} 座</div>
            </div>
          </div>
        </div>
        <div v-else class="no-halls">
          暂无影厅
        </div>
      </div>
    </div>

    <div v-if="showCinemaModal" class="modal-overlay" @click.self="showCinemaModal = false">
      <div class="modal card">
        <h2>新增影院</h2>
        <form @submit.prevent="handleCinemaSubmit">
          <div class="form-group">
            <label>影院名称</label>
            <input type="text" v-model="cinemaForm.name" class="form-input" required />
          </div>
          <div class="form-group">
            <label>地址</label>
            <input type="text" v-model="cinemaForm.location" class="form-input" required />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showCinemaModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showHallModal" class="modal-overlay" @click.self="showHallModal = false">
      <div class="modal card">
        <h2>新增影厅 - {{ currentCinema?.name }}</h2>
        <form @submit.prevent="handleHallSubmit">
          <div class="form-group">
            <label>影厅名称</label>
            <input type="text" v-model="hallForm.name" class="form-input" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>行数</label>
              <input type="number" v-model="hallForm.rows_count" class="form-input" min="1" max="20" required />
            </div>
            <div class="form-group">
              <label>列数</label>
              <input type="number" v-model="hallForm.cols_count" class="form-input" min="1" max="30" required />
            </div>
          </div>
          <p class="seat-preview">共 {{ hallForm.rows_count * hallForm.cols_count }} 个座位（前2行为VIP座）</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showHallModal = false">取消</button>
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
import { getCinemas, getHallsByCinema, createCinema, createHall } from '../../api/cinema'

const cinemas = ref([])
const cinemaHalls = ref({})
const loading = ref(true)
const showCinemaModal = ref(false)
const showHallModal = ref(false)
const currentCinema = ref(null)
const submitting = ref(false)

const cinemaForm = ref({
  name: '',
  location: ''
})

const hallForm = ref({
  name: '',
  rows_count: 8,
  cols_count: 10
})

const loadCinemas = async () => {
  loading.value = true
  try {
    const res = await getCinemas()
    cinemas.value = res.cinemas
    
    for (const cinema of res.cinemas) {
      const hallsRes = await getHallsByCinema(cinema.id)
      cinemaHalls.value[cinema.id] = hallsRes.halls
    }
  } catch (error) {
    console.error('加载影院失败:', error)
  } finally {
    loading.value = false
  }
}

const openCinemaModal = () => {
  cinemaForm.value = { name: '', location: '' }
  showCinemaModal.value = true
}

const openHallModal = (cinema) => {
  currentCinema.value = cinema
  hallForm.value = { name: '', rows_count: 8, cols_count: 10 }
  showHallModal.value = true
}

const handleCinemaSubmit = async () => {
  submitting.value = true
  try {
    await createCinema(cinemaForm.value)
    alert('创建成功')
    showCinemaModal.value = false
    loadCinemas()
  } catch (error) {
    alert(error.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

const handleHallSubmit = async () => {
  submitting.value = true
  try {
    await createHall({
      cinema_id: currentCinema.value.id,
      ...hallForm.value
    })
    alert('创建成功')
    showHallModal.value = false
    loadCinemas()
  } catch (error) {
    alert(error.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

const deleteCinema = async (cinema) => {
  alert('删除功能请在后端实现，当前为演示版本')
}

onMounted(() => {
  loadCinemas()
})
</script>

<style scoped>
.admin-cinemas {
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

.cinemas-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cinema-card {
  padding: 24px;
}

.cinema-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.cinema-name {
  font-size: 20px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.cinema-location {
  color: #888;
  font-size: 14px;
}

.cinema-actions {
  display: flex;
  gap: 12px;
}

.halls-section {
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.halls-section h4 {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 12px;
}

.halls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.hall-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  text-align: center;
}

.hall-name {
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.hall-info {
  color: #888;
  font-size: 13px;
  margin-bottom: 4px;
}

.hall-seats {
  color: #e94560;
  font-size: 14px;
  font-weight: 600;
}

.no-halls {
  padding: 16px;
  color: #666;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
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
  max-width: 400px;
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

.seat-preview {
  padding: 12px;
  background: rgba(233, 69, 96, 0.1);
  border-radius: 8px;
  color: #e94560;
  text-align: center;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>

<template>
  <div class="admin-orders">
    <div class="page-header">
      <h1>📋 订单管理</h1>
      <div class="filter">
        <select v-model="statusFilter" class="form-input" @change="loadOrders">
          <option value="">全部状态</option>
          <option value="pending">待支付</option>
          <option value="paid">已支付</option>
          <option value="cancelled">已取消</option>
          <option value="refunded">已退款</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="orders-table-wrapper card">
      <table class="orders-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>用户</th>
            <th>电影</th>
            <th>场次时间</th>
            <th>金额</th>
            <th>状态</th>
            <th>下单时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td class="order-no">{{ order.order_no }}</td>
            <td>{{ order.username }}</td>
            <td class="movie-name">{{ order.movie_title }}</td>
            <td>{{ formatDateTime(order.start_time) }}</td>
            <td class="amount">¥{{ order.total_amount }}</td>
            <td>
              <span class="status-badge" :class="order.status">
                {{ statusMap[order.status] }}
              </span>
            </td>
            <td>{{ formatDateTime(order.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="pagination" class="pagination">
        <span>共 {{ pagination.total }} 条记录</span>
        <div class="page-buttons">
          <button 
            class="btn btn-secondary btn-sm" 
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            上一页
          </button>
          <span>{{ pagination.page }} / {{ pagination.total_pages }}</span>
          <button 
            class="btn btn-secondary btn-sm"
            :disabled="pagination.page >= pagination.total_pages"
            @click="changePage(pagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAllOrders } from '../../api/admin'

const orders = ref([])
const pagination = ref(null)
const loading = ref(true)
const statusFilter = ref('')
const currentPage = ref(1)

const statusMap = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款'
}

const formatDateTime = (datetime) => {
  if (!datetime) return '-'
  const parts = datetime.split(' ')
  return `${parts[0]} ${parts[1].substring(0, 5)}`
}

const loadOrders = async () => {
  loading.value = true
  try {
    const params = { page: currentPage.value, page_size: 10 }
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    const res = await getAllOrders(params)
    orders.value = res.orders
    pagination.value = res.pagination
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

const changePage = (page) => {
  currentPage.value = page
  loadOrders()
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.admin-orders {
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

.filter .form-input {
  width: 150px;
}

.orders-table-wrapper {
  overflow-x: auto;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
}

.orders-table th,
.orders-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.orders-table th {
  color: #888;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
}

.order-no {
  font-family: monospace;
  font-size: 13px;
  color: #e94560;
}

.movie-name {
  font-weight: 600;
  color: #e0e0e0;
}

.amount {
  color: #e94560;
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
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
.status-badge.refunded {
  background: rgba(134, 142, 150, 0.2);
  color: #868e96;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  color: #888;
  font-size: 14px;
}

.page-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
</style>

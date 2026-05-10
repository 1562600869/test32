<template>
  <div class="admin-users">
    <div class="page-header">
      <h1>👥 用户管理</h1>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="users-table-wrapper card">
      <table class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>注册时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td class="username">{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-badge" :class="user.role">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </td>
            <td>{{ formatDateTime(user.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAllUsers } from '../../api/admin'

const users = ref([])
const loading = ref(true)

const formatDateTime = (datetime) => {
  if (!datetime) return '-'
  const parts = datetime.split(' ')
  return `${parts[0]} ${parts[1].substring(0, 5)}`
}

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await getAllUsers()
    users.value = res.users
  } catch (error) {
    console.error('加载用户失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-users {
  min-height: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #e0e0e0;
}

.users-table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.users-table th {
  color: #888;
  font-weight: 500;
  font-size: 13px;
  text-transform: uppercase;
}

.username {
  font-weight: 600;
  color: #e0e0e0;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.role-badge.admin {
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
}

.role-badge.user {
  background: rgba(81, 207, 102, 0.2);
  color: #51cf66;
}
</style>

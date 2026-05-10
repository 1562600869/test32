<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="logo-icon">🎬</span>
          <h1>注册</h1>
          <p>创建账号，开始电影之旅</p>
        </div>
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" v-model="form.username" class="form-input" placeholder="请输入用户名" required />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="form.email" class="form-input" placeholder="请输入邮箱" required />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" v-model="form.password" class="form-input" placeholder="请输入密码（至少6位）" required />
          </div>
          <div v-if="error" class="error-message">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading">注册中...</span>
            <span v-else>注册</span>
          </button>
        </form>
        <div class="auth-footer">
          <span>已有账号？</span>
          <router-link to="/login">立即登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  username: '',
  email: '',
  password: ''
})
const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  if (form.value.password.length < 6) {
    error.value = '密码至少6位'
    return
  }
  
  error.value = ''
  loading.value = true
  
  try {
    await userStore.register(form.value)
    router.push('/')
  } catch (err) {
    error.value = err.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-container {
  width: 100%;
  max-width: 420px;
}

.auth-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-header .logo-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.auth-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
  color: #e0e0e0;
}

.auth-header p {
  color: #888;
}

.btn-block {
  width: 100%;
  margin-top: 24px;
}

.auth-footer {
  text-align: center;
  margin-top: 24px;
  color: #888;
}

.auth-footer a {
  color: #e94560;
  text-decoration: none;
  margin-left: 4px;
}

.auth-footer a:hover {
  text-decoration: underline;
}
</style>

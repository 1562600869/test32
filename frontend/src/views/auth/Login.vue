<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <span class="logo-icon">🎬</span>
          <h1>登录</h1>
          <p>欢迎回来，登录继续购票</p>
        </div>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label>用户名/邮箱</label>
            <input type="text" v-model="form.username" class="form-input" placeholder="请输入用户名或邮箱" required />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" v-model="form.password" class="form-input" placeholder="请输入密码" required />
          </div>
          <div v-if="error" class="error-message">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading">登录中...</span>
            <span v-else>登录</span>
          </button>
        </form>
        <div class="auth-footer">
          <span>还没有账号？</span>
          <router-link to="/register">立即注册</router-link>
        </div>
        <div class="test-accounts">
          <p>测试账号：</p>
          <p>管理员：admin / admin123</p>
          <p>普通用户：user1 / user123456</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../../stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = ref({
  username: '',
  password: ''
})
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  
  try {
    await userStore.login(form.value)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    error.value = err.message || '登录失败'
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

.test-accounts {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  font-size: 12px;
  color: #666;
}

.test-accounts p {
  margin-bottom: 4px;
}
</style>

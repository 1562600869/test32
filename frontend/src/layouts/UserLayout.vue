<template>
  <div class="user-layout">
    <header class="header">
      <div class="container header-inner">
        <router-link to="/" class="logo">
          <span class="logo-icon">🎬</span>
          <span class="logo-text">电影票务</span>
        </router-link>
        <nav class="nav">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link to="/orders" class="nav-link" v-if="userStore.isAuthenticated">我的订单</router-link>
        </nav>
        <div class="user-actions">
          <template v-if="userStore.isAuthenticated">
            <span class="username">{{ userStore.user?.username }}</span>
            <button v-if="userStore.isAdmin" class="btn btn-secondary btn-sm" @click="goToAdmin">管理后台</button>
            <button class="btn btn-secondary btn-sm" @click="logout">退出</button>
          </template>
          <template v-else>
            <router-link to="/login" class="btn btn-secondary btn-sm">登录</router-link>
            <router-link to="/register" class="btn btn-primary btn-sm">注册</router-link>
          </template>
        </div>
      </div>
    </header>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

const logout = () => {
  userStore.logout()
  router.push('/')
}

const goToAdmin = () => {
  router.push('/admin')
}
</script>

<style scoped>
.user-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 70px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #e0e0e0;
  font-size: 20px;
  font-weight: 700;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav {
  display: flex;
  gap: 32px;
}

.nav-link {
  color: #aaa;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: #e94560;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  color: #e0e0e0;
  font-weight: 500;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.main-content {
  flex: 1;
}
</style>

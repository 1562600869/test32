<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="logo-icon">🎬</span>
        <span class="logo-text">管理后台</span>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/admin" class="nav-item">
          <span class="nav-icon">📊</span>
          <span>数据概览</span>
        </router-link>
        <router-link to="/admin/movies" class="nav-item">
          <span class="nav-icon">🎥</span>
          <span>影片管理</span>
        </router-link>
        <router-link to="/admin/showtimes" class="nav-item">
          <span class="nav-icon">📅</span>
          <span>场次管理</span>
        </router-link>
        <router-link to="/admin/cinemas" class="nav-item">
          <span class="nav-icon">🏢</span>
          <span>影院管理</span>
        </router-link>
        <router-link to="/admin/orders" class="nav-item">
          <span class="nav-icon">📋</span>
          <span>订单管理</span>
        </router-link>
        <router-link to="/admin/users" class="nav-item">
          <span class="nav-icon">👥</span>
          <span>用户管理</span>
        </router-link>
      </nav>
    </aside>
    <div class="main-section">
      <header class="admin-header">
        <div class="header-left">
          <router-link to="/" class="back-btn">← 返回前台</router-link>
        </div>
        <div class="header-right">
          <span class="username">{{ userStore.user?.username }}</span>
          <button class="btn btn-secondary btn-sm" @click="logout">退出</button>
        </div>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

const logout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: rgba(0, 0, 0, 0.5);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  position: fixed;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-header {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #e94560, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar-nav {
  padding: 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: #aaa;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  margin-bottom: 4px;
}

.nav-item:hover {
  background: rgba(233, 69, 96, 0.1);
  color: #e0e0e0;
}

.nav-item.router-link-active {
  background: linear-gradient(135deg, rgba(233, 69, 96, 0.3), rgba(255, 107, 107, 0.2));
  color: #fff;
}

.nav-icon {
  font-size: 18px;
}

.main-section {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.back-btn {
  color: #e94560;
  text-decoration: none;
  font-weight: 500;
}

.back-btn:hover {
  text-decoration: underline;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  color: #e0e0e0;
  font-weight: 500;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.admin-content {
  flex: 1;
  padding: 32px;
}
</style>

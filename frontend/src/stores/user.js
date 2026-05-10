import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi, getCurrentUser } from '../api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || '')
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  const init = async () => {
    if (token.value) {
      try {
        const res = await getCurrentUser()
        user.value = res.user
      } catch (error) {
        logout()
      }
    }
  }

  const login = async (credentials) => {
    const res = await loginApi(credentials)
    user.value = res.user
    token.value = res.token
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  const register = async (data) => {
    const res = await registerApi(data)
    user.value = res.user
    token.value = res.token
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  const logout = () => {
    user.value = null
    token.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const loadFromStorage = () => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      user.value = JSON.parse(storedUser)
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    init,
    login,
    register,
    logout,
    loadFromStorage
  }
})

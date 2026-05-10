import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/',
    component: () => import('../layouts/UserLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/user/Home.vue')
      },
      {
        path: 'movie/:id',
        name: 'MovieDetail',
        component: () => import('../views/user/MovieDetail.vue')
      },
      {
        path: 'showtime/:id',
        name: 'SeatSelection',
        component: () => import('../views/user/SeatSelection.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'payment/:orderNo',
        name: 'Payment',
        component: () => import('../views/user/Payment.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'order/:orderNo',
        name: 'OrderDetail',
        component: () => import('../views/user/OrderDetail.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'orders',
        name: 'MyOrders',
        component: () => import('../views/user/MyOrders.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/auth/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/auth/Register.vue')
  },
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: () => import('../views/admin/Dashboard.vue')
      },
      {
        path: 'movies',
        name: 'AdminMovies',
        component: () => import('../views/admin/Movies.vue')
      },
      {
        path: 'showtimes',
        name: 'AdminShowtimes',
        component: () => import('../views/admin/Showtimes.vue')
      },
      {
        path: 'cinemas',
        name: 'AdminCinemas',
        component: () => import('../views/admin/Cinemas.vue')
      },
      {
        path: 'orders',
        name: 'AdminOrders',
        component: () => import('../views/admin/Orders.vue')
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/Users.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  
  if (!userStore.user && localStorage.getItem('token')) {
    userStore.loadFromStorage()
  }

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresAdmin && !userStore.isAdmin) {
    next({ path: '/' })
    return
  }

  next()
})

export default router

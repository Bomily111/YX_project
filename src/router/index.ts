import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/index.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

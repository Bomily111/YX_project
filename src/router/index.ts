import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Dashboard from '@/views/index.vue'
import BlastTwinPage from '@/views/BlastTwinPage.vue'
import SupportTwinPage from '@/views/SupportTwinPage.vue'
import VentilationTwinPage from '@/views/VentilationTwinPage.vue'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import AdminWorksites from '@/views/admin/WorksitesPage.vue'
import AdminModels from '@/views/admin/ModelsPage.vue'
import AdminAlerts from '@/views/admin/AlertsPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/blast-twin',
    name: 'BlastTwin',
    component: BlastTwinPage
  },
  {
    path: '/support-experiment',
    name: 'SupportTwin',
    component: SupportTwinPage
  },
  {
    path: '/ventilation-twin',
    name: 'VentilationTwin',
    component: VentilationTwinPage
  },
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      { path: '', redirect: '/admin/worksites' },
      { path: 'worksites', name: 'AdminWorksites', component: AdminWorksites },
      { path: 'models', name: 'AdminModels', component: AdminModels },
      { path: 'alerts', name: 'AdminAlerts', component: AdminAlerts },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

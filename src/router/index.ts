import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
  {
    path: '/projects/:encoded',
    name: 'project',
    component: () => import('@/views/ProjectDetailView.vue'),
    props: true,
  },
  { path: '/projects', name: 'projects', component: () => import('@/views/ProjectsHubView.vue') },
  {
    path: '/sessions/:encoded/:id',
    name: 'session',
    component: () => import('@/views/SessionDetailView.vue'),
    props: true,
  },
  { path: '/sessions/:encoded?', name: 'sessions', component: () => import('@/views/SessionsView.vue') },
  {
    path: '/mcp',
    name: 'mcp',
    component: () => import('@/views/McpView.vue'),
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/SkillsView.vue'),
  },
  {
    path: '/memory',
    name: 'memory',
    component: () => import('@/views/MemoryView.vue'),
  },
  {
    path: '/plans',
    name: 'plans',
    component: () => import('@/views/PlansView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})

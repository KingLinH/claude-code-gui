import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { ProjectInfo } from '@shared/types'

export const useProjectsStore = defineStore('projects', () => {
  const list = ref<ProjectInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const fetched = ref(false)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      list.value = await api.projects()
      fetched.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  return { list, loading, error, fetched, fetch }
})

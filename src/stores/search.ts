import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { SearchHit } from '@shared/types'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const hits = ref<SearchHit[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run(q: string) {
    query.value = q
    if (!q.trim()) {
      hits.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      hits.value = await api.search(q.trim())
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  return { query, hits, loading, error, run }
})

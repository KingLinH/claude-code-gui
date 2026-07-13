import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'

export interface PlanInfo {
  file: string
  title: string
  sizeBytes: number
  mtimeMs: number
}

export const usePlansStore = defineStore('plans', () => {
  const list = ref<PlanInfo[]>([])
  const detail = ref<{ file: string; body: string; mtimeMs: number } | null>(null)
  const loading = ref(false)
  const loadingDetail = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    try {
      list.value = await api.plans()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(file: string) {
    loadingDetail.value = true
    detail.value = null
    try {
      detail.value = await api.planDetail(file)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loadingDetail.value = false
    }
  }

  return { list, detail, loading, loadingDetail, error, fetch, fetchDetail }
})

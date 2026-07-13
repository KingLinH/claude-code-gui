import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { MemoryDetail, MemoryListResponse } from '@shared/types'

export const useMemoryStore = defineStore('memory', () => {
  const byProject = ref<Record<string, MemoryListResponse>>({})
  const detail = ref<MemoryDetail | null>(null)
  const loading = ref(false)
  const loadingDetail = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const lastBackup = ref<string | null>(null)

  async function fetchList(encoded: string) {
    loading.value = true
    try {
      byProject.value[encoded] = await api.memory(encoded)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(encoded: string, slug: string) {
    loadingDetail.value = true
    detail.value = null
    try {
      detail.value = await api.memoryDetail(encoded, slug)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loadingDetail.value = false
    }
  }

  async function save(encoded: string, slug: string, content: string) {
    saving.value = true
    try {
      const r = await api.saveMemory(encoded, slug, content)
      lastBackup.value = r.backup
      await fetchList(encoded)
      return r
    } finally {
      saving.value = false
    }
  }

  async function create(encoded: string, slug: string, content: string) {
    saving.value = true
    try {
      const r = await api.createMemory(encoded, slug, content)
      await fetchList(encoded)
      return r
    } finally {
      saving.value = false
    }
  }

  async function remove(encoded: string, slug: string) {
    saving.value = true
    try {
      const r = await api.deleteMemory(encoded, slug)
      await fetchList(encoded)
      return r
    } finally {
      saving.value = false
    }
  }

  return {
    byProject,
    detail,
    loading,
    loadingDetail,
    saving,
    error,
    lastBackup,
    fetchList,
    fetchDetail,
    save,
    create,
    remove,
  }
})

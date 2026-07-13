import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { SkillDetail, SkillInfo } from '@shared/types'

export const useSkillsStore = defineStore('skills', () => {
  const list = ref<SkillInfo[]>([])
  const detail = ref<SkillDetail | null>(null)
  const loading = ref(false)
  const loadingDetail = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const fetched = ref(false)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      list.value = await api.skills()
      fetched.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string) {
    loadingDetail.value = true
    detail.value = null
    try {
      detail.value = await api.skillDetail(id)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loadingDetail.value = false
    }
  }

  async function save(id: string, content: string) {
    saving.value = true
    try {
      const r = await api.saveSkill(id, content)
      detail.value = r.detail
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  async function create(name: string, content: string) {
    saving.value = true
    try {
      const r = await api.createSkill(name, content)
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  async function remove(id: string) {
    saving.value = true
    try {
      const r = await api.deleteSkill(id)
      detail.value = null
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  return {
    list,
    detail,
    loading,
    loadingDetail,
    saving,
    error,
    fetched,
    fetch,
    fetchDetail,
    save,
    create,
    remove,
  }
})

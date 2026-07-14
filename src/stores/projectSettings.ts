import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { ProjectSettingsResponse } from '@shared/types'

export const useProjectSettingsStore = defineStore('projectSettings', () => {
  const data = ref<ProjectSettingsResponse | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const lastBackup = ref<string | null>(null)

  async function fetch(encoded: string) {
    loading.value = true
    error.value = null
    try {
      data.value = await api.projectSettings(encoded)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function save(encoded: string, settings: Record<string, unknown>) {
    saving.value = true
    try {
      const r = await api.saveProjectSettings(encoded, settings)
      lastBackup.value = r.backup
      await fetch(encoded)
      return r
    } finally {
      saving.value = false
    }
  }

  return { data, loading, saving, error, lastBackup, fetch, save }
})

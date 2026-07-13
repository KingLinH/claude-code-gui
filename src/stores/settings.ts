import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'

export interface SettingsState {
  settings: Record<string, unknown>
  configHasApiKey: boolean
  apiKeyMasked?: string
  mtimeMs: number
}

export const useSettingsStore = defineStore('settings', () => {
  const data = ref<SettingsState | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const lastBackup = ref<string | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      data.value = await api.settings()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function save(settings: Record<string, unknown>) {
    saving.value = true
    try {
      const r = await api.saveSettings(settings)
      lastBackup.value = r.backup
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  return { data, loading, saving, error, lastBackup, fetch, save }
})

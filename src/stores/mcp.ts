import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { McpScope, McpServer } from '@shared/types'

export const useMcpStore = defineStore('mcp', () => {
  const scope = ref<McpScope | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const lastBackup = ref<string | null>(null)
  const lastSavedAt = ref<number | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      scope.value = await api.mcp()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function saveGlobal(mcpServers: Record<string, McpServer>) {
    saving.value = true
    try {
      const r = await api.saveMcpGlobal(mcpServers)
      lastBackup.value = r.backup
      lastSavedAt.value = Date.now()
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  async function saveProject(path: string, mcpServers: Record<string, McpServer>) {
    saving.value = true
    try {
      const r = await api.saveMcpProject(path, mcpServers)
      lastBackup.value = r.backup
      lastSavedAt.value = Date.now()
      await fetch()
      return r
    } finally {
      saving.value = false
    }
  }

  return { scope, loading, saving, error, lastBackup, lastSavedAt, fetch, saveGlobal, saveProject }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { LiveSession, SessionSummary } from '@shared/types'

export const useSessionsStore = defineStore('sessions', () => {
  const byProject = ref<Record<string, SessionSummary[]>>({})
  const loadingProject = ref<Record<string, boolean>>({})
  const live = ref<LiveSession[]>([])
  const liveLoading = ref(false)

  async function fetchSessions(encoded: string) {
    loadingProject.value[encoded] = true
    try {
      byProject.value[encoded] = await api.sessions(encoded)
    } catch {
      byProject.value[encoded] = []
    } finally {
      loadingProject.value[encoded] = false
    }
  }

  async function fetchLive() {
    liveLoading.value = true
    try {
      live.value = await api.live()
    } catch {
      live.value = []
    } finally {
      liveLoading.value = false
    }
  }

  function isLive(encoded: string, sessionId: string): boolean {
    return live.value.some((s) => s.encoded === encoded && s.sessionId === sessionId)
  }

  async function rename(encoded: string, id: string, title: string) {
    const r = await api.renameSession(encoded, id, title)
    await fetchSessions(encoded)
    return r
  }

  async function remove(encoded: string, id: string) {
    const r = await api.deleteSession(encoded, id)
    await fetchSessions(encoded)
    return r
  }

  return {
    byProject,
    loadingProject,
    live,
    liveLoading,
    fetchSessions,
    fetchLive,
    isLive,
    rename,
    remove,
  }
})

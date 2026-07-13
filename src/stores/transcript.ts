import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { SessionSummary, SubagentInfo, Turn } from '@shared/types'

export const useTranscriptStore = defineStore('transcript', () => {
  const turns = ref<Turn[]>([])
  const summary = ref<SessionSummary | null>(null)
  const subagents = ref<SubagentInfo[]>([])
  const total = ref(0)
  const limit = ref(100)
  const malformedCount = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)

  const hasMore = computed(() => turns.value.length < total.value)

  function reset() {
    turns.value = []
    summary.value = null
    subagents.value = []
    total.value = 0
    malformedCount.value = 0
    error.value = null
  }

  async function load(encoded: string, id: string) {
    reset()
    loading.value = true
    try {
      const r = await api.messages(encoded, id, { offset: 0, limit: limit.value })
      turns.value = r.turns
      summary.value = {
        ...r.summary,
        sizeBytes: 0,
        mtimeMs: 0,
        hasSubagents: !!(r.subagents && r.subagents.length),
      } as SessionSummary
      subagents.value = r.subagents ?? []
      total.value = r.total
      malformedCount.value = r.malformedCount
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadMore(encoded: string, id: string) {
    if (loadingMore.value || loading.value || !hasMore.value) return
    loadingMore.value = true
    try {
      const last = lastConversationUuid()
      const r = await api.messages(encoded, id, { after: last, limit: limit.value })
      turns.value.push(...r.turns)
      total.value = r.total
    } catch {
      /* ignore pagination errors */
    } finally {
      loadingMore.value = false
    }
  }

  function lastConversationUuid(): string | undefined {
    for (let i = turns.value.length - 1; i >= 0; i--) {
      const t = turns.value[i]
      if (t.kind !== 'tool_result') return t.uuid
    }
    return undefined
  }

  return {
    turns,
    summary,
    subagents,
    total,
    limit,
    malformedCount,
    loading,
    loadingMore,
    error,
    hasMore,
    load,
    loadMore,
    reset,
  }
})

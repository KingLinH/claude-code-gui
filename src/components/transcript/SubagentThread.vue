<script setup lang="ts">
import { ref, watch } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { api } from '@/api/client'
import type { ToolCall, Turn } from '@shared/types'
import TurnList from './TurnList.vue'
import { t } from '@/i18n'

const props = defineProps<{ call: ToolCall; encoded?: string; sessionId?: string }>()
const open = ref(false)
const loading = ref(false)
const turns = ref<Turn[]>([])
const error = ref<string | null>(null)
const loaded = ref(false)

async function ensure() {
  if (loaded.value || loading.value) return
  if (!props.encoded || !props.sessionId || !props.call.subagent) return
  loading.value = true
  try {
    const r = await api.subagentMessages(props.encoded, props.sessionId, props.call.subagent.agentId)
    turns.value = r.turns
    loaded.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

watch(open, (v) => {
  if (v) ensure()
})
</script>

<template>
  <div class="rounded-lg border border-accent/25 bg-accent/5">
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-accent/10"
      @click="open = !open"
    >
      <NIcon :component="open ? ChevronDownOutline : ChevronForwardOutline" :size="12" class="text-accent" />
      <span class="font-medium text-accent">{{ call.subagent?.agentType || 'subagent' }}</span>
      <span v-if="call.subagent?.description" class="truncate text-text-dim">· {{ call.subagent.description }}</span>
      <span class="ml-auto text-[11px] text-text-faint">{{ t('transcript.depth', { n: call.subagent?.spawnDepth ?? 1 }) }}</span>
    </button>
    <div v-if="open" class="border-t border-accent/20 px-3 py-3">
      <div v-if="loading" class="flex items-center gap-2 py-3 text-text-faint">
        <NSpin :size="14" /> <span class="text-[12px]">{{ t('transcript.loadingSubagent') }}</span>
      </div>
      <div v-else-if="error" class="py-2 text-[12px] text-danger">{{ error }}</div>
      <TurnList v-else :turns="turns" :encoded="encoded" :session-id="sessionId" />
    </div>
  </div>
</template>

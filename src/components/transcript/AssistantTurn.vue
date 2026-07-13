<script setup lang="ts">
import type { Turn } from '@shared/types'
import ThinkingBlock from './ThinkingBlock.vue'
import MarkdownBlock from './MarkdownBlock.vue'
import ToolCallBlock from './ToolCallBlock.vue'
import { t } from '@/i18n'

defineProps<{
  turn: Extract<Turn, { kind: 'assistant' }>
  encoded?: string
  sessionId?: string
}>()
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
      <span>{{ t('transcript.claude') }}</span>
      <span v-if="turn.model" class="font-mono font-normal normal-case text-text-faint/70">{{ turn.model }}</span>
    </div>
    <div class="space-y-2">
      <ThinkingBlock v-for="(t, i) in turn.thinking" :key="`t${i}`" :text="t" />
      <MarkdownBlock v-for="(t, i) in turn.text" :key="`x${i}`" :content="t" />
      <ToolCallBlock
        v-for="c in turn.toolCalls"
        :key="c.id"
        :call="c"
        :encoded="encoded"
        :session-id="sessionId"
      />
    </div>
  </div>
</template>

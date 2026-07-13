<script setup lang="ts">
import type { Turn } from '@shared/types'
import MarkdownBlock from './MarkdownBlock.vue'
import { t } from '@/i18n'

defineProps<{ turn: Extract<Turn, { kind: 'user' }> }>()
</script>

<template>
  <div class="space-y-1.5">
    <div class="text-[11px] font-semibold uppercase tracking-wider text-text-faint">{{ t('transcript.you') }}</div>
    <div class="rounded-lg border border-border bg-surface px-4 py-3">
      <MarkdownBlock :content="turn.text" />
    </div>
  </div>
</template>

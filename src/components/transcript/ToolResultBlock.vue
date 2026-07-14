<script setup lang="ts">
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { t } from '@/i18n'

const props = defineProps<{ result: { content: string; isError: boolean } }>()
const open = ref(false)

const lineCount = computed(() => (props.result.content.match(/\n/g)?.length ?? 0) + 1)
const truncated = computed(() => /\[truncated /.test(props.result.content))
</script>

<template>
  <div class="overflow-hidden rounded-lg border" :class="result.isError ? 'border-danger/40' : 'border-border'">
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] hover:bg-surface-2"
      @click="open = !open"
    >
      <NIcon :component="open ? ChevronDownOutline : ChevronForwardOutline" :size="12" class="text-text-faint" />
      <span :class="result.isError ? 'text-danger' : 'text-success'">●</span>
      <span class="text-text-faint">{{ result.isError ? t('transcript.errorOutput') : t('transcript.output') }}</span>
      <span class="text-text-faint">{{ t('transcript.lines', { n: lineCount }) }}</span>
      <span v-if="truncated" class="text-warning">{{ t('transcript.truncated') }}</span>
    </button>
    <pre
      v-if="open"
      class="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-border bg-[var(--code-bg)] p-3 font-mono text-[12px] leading-relaxed text-text-dim"
    >{{ result.content }}</pre>
  </div>
</template>

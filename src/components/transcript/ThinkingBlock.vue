<script setup lang="ts">
import { ref } from 'vue'
import { NIcon } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { t } from '@/i18n'

defineProps<{ text: string }>()
const open = ref(false)
</script>

<template>
  <div class="rounded-lg border border-border/60 bg-surface-2/40">
    <button
      class="flex w-full items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-faint transition-colors hover:text-text-dim"
      @click="open = !open"
    >
      <NIcon :component="open ? ChevronDownOutline : ChevronForwardOutline" :size="12" />
      <span class="italic">{{ t('transcript.thinking') }}</span>
    </button>
    <div
      v-if="open"
      class="max-h-80 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-mono text-[12.5px] leading-relaxed text-text-faint"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NIcon } from 'naive-ui'
import { CheckmarkOutline, CopyOutline } from '@vicons/ionicons5'

const props = defineProps<{ code: string; lang?: string; title?: string }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard unavailable */
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-[#0a0a0c]">
    <div class="flex items-center justify-between border-b border-border bg-surface px-3 py-1">
      <span class="truncate text-[11px] uppercase tracking-wide text-text-faint">
        {{ lang || title || 'text' }}
      </span>
      <button
        class="text-text-faint transition-colors hover:text-text"
        title="Copy"
        @click="copy"
      >
        <NIcon :component="copied ? CheckmarkOutline : CopyOutline" :size="14" />
      </button>
    </div>
    <pre class="overflow-auto p-3 font-mono text-[12.5px] leading-relaxed text-text"><code>{{ code }}</code></pre>
  </div>
</template>

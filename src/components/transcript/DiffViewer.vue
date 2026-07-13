<script setup lang="ts">
import { computed } from 'vue'
import { diffLines } from 'diff'

const props = defineProps<{
  oldText?: string
  newText?: string
  title?: string
  mode?: 'edit' | 'write'
}>()

interface Part {
  value: string
  added?: boolean
  removed?: boolean
}

const parts = computed<Part[]>(() => {
  if (props.mode === 'write' || props.oldText == null) {
    return [{ value: props.newText ?? '', added: true }]
  }
  return diffLines(props.oldText ?? '', props.newText ?? '')
})
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-[#0a0a0c] font-mono text-[12.5px]">
    <div
      v-if="title"
      class="truncate border-b border-border bg-surface px-3 py-1 text-[11px] text-text-dim"
    >
      {{ title }}
    </div>
    <pre class="overflow-auto p-2 leading-relaxed"><span
      v-for="(p, i) in parts"
      :key="i"
      :class="[
        p.added
          ? 'bg-success/15 text-success'
          : p.removed
            ? 'bg-danger/15 text-danger'
            : 'text-text-dim',
      ]"
    >{{ p.value }}</span></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{ content: string }>()
const html = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div class="md" v-html="html" />
</template>

<style scoped>
.md {
  font-size: 13.5px;
  line-height: 1.65;
}
.md :deep(p) {
  margin: 0.5em 0;
}
.md :deep(p:first-child) {
  margin-top: 0;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(ul),
.md :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.md :deep(li) {
  margin: 0.2em 0;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4) {
  margin: 0.7em 0 0.35em;
  font-weight: 600;
  line-height: 1.3;
}
.md :deep(h1) { font-size: 1.3em; }
.md :deep(h2) { font-size: 1.18em; }
.md :deep(h3) { font-size: 1.06em; }
.md :deep(code):not(.hljs code) {
  font-family: var(--mono);
  font-size: 0.86em;
  background: var(--surface-2);
  padding: 0.12em 0.38em;
  border-radius: 4px;
  color: var(--text);
}
.md :deep(pre) {
  margin: 0.6em 0;
  border-radius: 8px;
  overflow: hidden;
}
.md :deep(.hljs) {
  background: var(--code-bg) !important;
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.6;
}
.md :deep(blockquote) {
  border-left: 2px solid var(--border);
  padding-left: 0.9em;
  color: var(--text-dim);
  margin: 0.6em 0;
}
.md :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.md :deep(a:hover) {
  text-decoration: underline;
}
.md :deep(table) {
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 0.92em;
  display: block;
  overflow-x: auto;
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid var(--border);
  padding: 0.35em 0.7em;
  text-align: left;
}
.md :deep(th) {
  background: var(--surface-2);
  font-weight: 600;
}
.md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 0.8em 0;
}
</style>

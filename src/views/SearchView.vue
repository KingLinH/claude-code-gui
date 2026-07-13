<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NInput, NSpin } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import { useSearchStore } from '@/stores/search'
import { useUrlQuery } from '@/composables/useUrlQuery'
import { t } from '@/i18n'
import type { SearchHit } from '@shared/types'

const store = useSearchStore()
const router = useRouter()
const { value: qParam, set: setQ } = useUrlQuery('q')
const input = ref(qParam.value)

function doSearch(v: string) {
  const q = v.trim()
  setQ(q)
  store.run(q)
}
function onInput(v: string) {
  input.value = v
  // no auto-search — only on Enter. Clear results when the box is emptied.
  if (!v) doSearch('')
}

// sync store to the URL on mount: search if ?q= present, otherwise clear stale results
store.run(qParam.value)

function open(h: SearchHit) {
  if (h.type === 'session') router.push({ name: 'session', params: { encoded: h.encoded!, id: h.sessionId! } })
  else if (h.type === 'memory') router.push(`/memory?project=${h.encoded}&slug=${h.slug}`)
  else if (h.type === 'skill') router.push(`/skills?skill=${h.skillId}`)
  else if (h.type === 'plan') router.push(`/plans?plan=${h.planFile}`)
}

const typeColor: Record<string, string> = {
  session: 'text-accent',
  memory: 'text-success',
  skill: 'text-warning',
  plan: 'text-text-dim',
}

interface Seg {
  text: string
  mark: boolean
}
function highlight(snippet: string, q: string): Seg[] {
  if (!q) return [{ text: snippet, mark: false }]
  const lower = snippet.toLowerCase()
  const ql = q.toLowerCase()
  const out: Seg[] = []
  let i = 0
  while (i <= snippet.length) {
    const j = lower.indexOf(ql, i)
    if (j < 0) {
      if (i < snippet.length) out.push({ text: snippet.slice(i), mark: false })
      break
    }
    if (j > i) out.push({ text: snippet.slice(i, j), mark: false })
    out.push({ text: snippet.slice(j, j + ql.length), mark: true })
    i = j + ql.length
  }
  return out
}
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <NInput
        :value="input"
        size="large"
        clearable
        :placeholder="t('search.placeholder')"
        @update:value="onInput"
        @keyup.enter="doSearch(input)"
      >
        <template #prefix><NIcon :component="SearchOutline" /></template>
      </NInput>

      <div class="mt-2 flex items-center gap-2 text-[12px] text-text-faint">
        <NSpin v-if="store.loading" :size="12" />
        <span v-else-if="store.query">{{ t('search.count', { n: store.hits.length }) }}</span>
        <span v-else>{{ t('search.hint') }}</span>
      </div>

      <div v-if="store.error" class="mt-3 text-danger">{{ store.error }}</div>

      <div v-else class="mt-3 space-y-2">
        <button
          v-for="(h, i) in store.hits"
          :key="i"
          class="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
          @click="open(h)"
        >
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold uppercase" :class="typeColor[h.type]">{{ t(`search.type.${h.type}`) }}</span>
            <span class="truncate text-[13.5px] font-medium text-text">{{ h.title }}</span>
            <span v-if="h.cwd" class="ml-auto shrink-0 max-w-[36ch] truncate text-[11px] text-text-faint" :title="h.cwd">{{ h.cwd }}</span>
          </div>
          <div v-if="h.label" class="mt-0.5 font-mono text-[11px] text-text-faint">{{ h.label }}</div>
          <div class="mt-1 text-[13px] leading-relaxed text-text-dim">
            <template v-for="(seg, si) in highlight(h.snippet, store.query)" :key="si">
              <mark v-if="seg.mark" class="rounded bg-accent/30 px-0.5 text-text">{{ seg.text }}</mark>
              <span v-else>{{ seg.text }}</span>
            </template>
          </div>
        </button>

        <div v-if="!store.loading && store.query && !store.hits.length" class="py-8 text-center text-[13px] text-text-faint">
          {{ t('search.noResults') }}
        </div>
        <div v-if="!store.query" class="py-8 text-center text-[13px] text-text-faint">
          {{ t('search.noQuery') }}
        </div>
      </div>
    </div>
  </div>
</template>

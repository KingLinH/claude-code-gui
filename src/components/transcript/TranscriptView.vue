<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { PlayOutline } from '@vicons/ionicons5'
import { useTranscriptStore } from '@/stores/transcript'
import { useProjectsStore } from '@/stores/projects'
import { api } from '@/api/client'
import { fmtDuration, fmtTime } from '@/utils/format'
import { t } from '@/i18n'
import TurnList from './TurnList.vue'

const props = defineProps<{ encoded: string; id: string }>()
const store = useTranscriptStore()
const projects = useProjectsStore()
const message = useMessage()
const s = computed(() => store.summary)

const projectCwd = computed(
  () => projects.list.find((p) => p.encoded === props.encoded)?.cwd || props.encoded,
)

function load() {
  store.load(props.encoded, props.id)
}

async function resume() {
  try {
    await api.resumeSession(props.encoded, props.id)
    message.success(t('resume.launched'))
  } catch (e) {
    message.error((e as Error).message)
  }
}

onMounted(() => {
  load()
  if (!projects.list.length) projects.fetch()
})
watch(() => [props.encoded, props.id], load)
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="shrink-0 border-b border-border px-6 py-3">
      <RouterLink
        :to="`/sessions/${encoded}`"
        class="flex items-center gap-1 text-[12px] text-text-faint transition-colors hover:text-text"
        :title="projectCwd"
      >
        <span>←</span>
        <span class="max-w-[44ch] truncate">{{ projectCwd }}</span>
      </RouterLink>
      <h1 class="mt-1 truncate text-[15px] font-semibold">
        {{ s?.aiTitle || s?.lastPrompt?.slice(0, 80) || id.slice(0, 8) }}
      </h1>
      <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-dim">
        <span v-if="s?.lastPrompt" class="max-w-[60ch] truncate">{{ s.lastPrompt }}</span>
        <span>{{ t('transcript.turns', { n: store.turns.length, m: store.total }) }}</span>
        <span v-if="s?.durationMs">⏱ {{ fmtDuration(s.durationMs) }}</span>
        <span v-if="s?.lastTs">{{ fmtTime(s.lastTs) }}</span>
        <span v-if="store.malformedCount" class="text-warning">⚠ {{ t('transcript.malformed', { n: store.malformedCount }) }}</span>
        <button
          class="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-text-dim transition-colors hover:bg-surface-2 hover:text-accent"
          :title="t('resume.run')"
          @click="resume"
        >
          <NIcon :component="PlayOutline" :size="13" />
          <span>{{ t('resume.run') }}</span>
        </button>
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="store.loading" class="px-6 py-10 text-text-faint">{{ t('transcript.loading') }}</div>
      <div v-else-if="store.error" class="px-6 py-10 text-danger">{{ store.error }}</div>
      <div v-else class="content-col px-6 py-6">
        <TurnList :turns="store.turns" :encoded="encoded" :session-id="id" />

        <div v-if="store.hasMore" class="py-6 text-center">
          <button
            class="rounded-md border border-border px-4 py-2 text-[13px] transition-colors hover:bg-surface-2 disabled:opacity-50"
            :disabled="store.loadingMore"
            @click="store.loadMore(encoded, id)"
          >
            <span v-if="store.loadingMore">{{ t('common.loading') }}</span>
            <span v-else>{{ t('transcript.loadMore', { n: store.total - store.turns.length }) }}</span>
          </button>
        </div>
        <div v-else-if="store.turns.length" class="py-6 text-center text-[12px] text-text-faint">
          {{ t('transcript.end') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NSpin, useMessage } from 'naive-ui'
import { CopyOutline, PlayOutline } from '@vicons/ionicons5'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { fmtCost, fmtDuration, fmtTokens, relTime } from '@/utils/format'
import { t } from '@/i18n'
import type { ProjectOverview } from '@shared/types'

const props = defineProps<{ encoded: string }>()
const message = useMessage()
const overview = ref<ProjectOverview | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const recent = computed(() => overview.value?.sessions.recent ?? [])
const last = computed(() => recent.value[0])
const resumeSessionId = computed(() => overview.value?.usage.lastSessionId ?? last.value?.sessionId)
const mcpScope = computed(() => overview.value?.cwd.replace(/\\/g, '/') ?? '')

async function load() {
  loading.value = true
  error.value = null
  overview.value = null
  try {
    overview.value = await api.projectOverview(props.encoded)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.encoded, load)

async function copyText(text: string, okKey: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(t(okKey))
  } catch {
    message.error('clipboard unavailable')
  }
}

async function resume() {
  const sid = resumeSessionId.value
  if (!sid) return
  try {
    await api.resumeSession(props.encoded, sid)
    message.success(t('resume.launched'))
  } catch (e) {
    message.error((e as Error).message)
  }
}
function copyPrompt() {
  const p = last.value?.lastPrompt
  if (!p) {
    message.warning(t('resume.noPrompt'))
    return
  }
  copyText(p, 'resume.copiedPrompt')
}

function titleOf(s: { aiTitle?: string; lastPrompt?: string; sessionId: string }) {
  return s.aiTitle || s.lastPrompt?.slice(0, 80) || s.sessionId.slice(0, 8)
}
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <RouterLink to="/projects" class="text-[12px] text-text-faint transition-colors hover:text-text">← {{ t('projects.title') }}</RouterLink>

      <div v-if="loading" class="py-10 text-text-faint"><NSpin /></div>
      <div v-else-if="error" class="py-10 text-danger">{{ error }}</div>
      <div v-else-if="overview">
        <!-- header -->
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <h1 class="text-[18px] font-semibold break-all">{{ overview.cwd }}</h1>
          <span v-if="overview.live" class="inline-flex items-center gap-1 text-[12px] text-success">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-success" />live
          </span>
        </div>

        <!-- reconnect -->
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <NButton size="small" type="primary" :disabled="!resumeSessionId" @click="resume">
            <template #icon><NIcon :component="PlayOutline" /></template>
            {{ t('resume.run') }}
          </NButton>
          <NButton size="small" :disabled="!last?.lastPrompt" @click="copyPrompt">
            <template #icon><NIcon :component="CopyOutline" /></template>
            {{ t('resume.copyPrompt') }}
          </NButton>
          <span v-if="!resumeSessionId" class="text-[11px] text-text-faint">{{ t('projects.noSessions') }}</span>
        </div>

        <!-- resource cards -->
        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RouterLink :to="`/sessions/${encoded}`" class="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2">
            <div class="text-[22px] font-semibold tabular-nums">{{ overview.sessions.count }}</div>
            <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ t('projects.col.sessions') }}</div>
          </RouterLink>
          <RouterLink to="/skills" class="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2">
            <div class="text-[22px] font-semibold tabular-nums">{{ overview.skillsCount }}</div>
            <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ t('projects.skills') }}</div>
          </RouterLink>
          <RouterLink :to="`/memory?project=${encoded}`" class="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2">
            <div class="text-[22px] font-semibold tabular-nums">{{ overview.memoryCount }}</div>
            <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ t('projects.memory') }}</div>
          </RouterLink>
          <RouterLink :to="`/mcp?scope=${encodeURIComponent(mcpScope)}`" class="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2">
            <div class="text-[22px] font-semibold tabular-nums">{{ overview.mcpServers.length }}</div>
            <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ t('projects.mcp') }}</div>
          </RouterLink>
        </div>

        <!-- recent sessions -->
        <section class="mt-6">
          <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('projects.recent') }}</div>
          <div v-if="!recent.length" class="mt-2 text-[13px] text-text-faint">{{ t('projects.noSessions') }}</div>
          <div v-else class="mt-2 space-y-1">
            <RouterLink
              v-for="s in recent"
              :key="s.sessionId"
              :to="{ name: 'session', params: { encoded, id: s.sessionId } }"
              class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] transition-colors hover:bg-surface-2"
            >
              <span class="truncate text-text">{{ titleOf(s) }}</span>
              <span class="ml-auto shrink-0 font-mono text-[12px] text-text-dim">{{ t('sessions.msgs', { n: s.messageCount }) }}</span>
              <span class="shrink-0 text-[11px] text-text-faint">{{ relTime(s.lastTs || s.mtimeMs) }}</span>
            </RouterLink>
            <RouterLink :to="`/sessions/${encoded}`" class="block py-1 text-center text-[12px] text-accent hover:underline">
              {{ t('projects.viewAll', { n: overview.sessions.count }) }}
            </RouterLink>
          </div>
        </section>

        <!-- usage + mcp names -->
        <section class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="rounded-lg border border-border bg-surface px-4 py-3">
            <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('projects.usage') }}</div>
            <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <span class="text-text-dim">{{ t('projects.col.cost') }}: <span class="text-text">{{ fmtCost(overview.usage.lastCost) }}</span></span>
              <span class="text-text-dim">{{ t('projects.col.tokens') }}: <span class="text-text">{{ fmtTokens(overview.usage.lastTotalInputTokens) }}</span> / {{ fmtTokens(overview.usage.lastTotalOutputTokens) }}</span>
              <span v-if="overview.usage.lastDuration" class="text-text-dim">⏱ {{ fmtDuration(overview.usage.lastDuration) }}</span>
            </div>
          </div>
          <div class="rounded-lg border border-border bg-surface px-4 py-3">
            <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('projects.mcp') }}</div>
            <div v-if="!overview.mcpServers.length" class="mt-2 text-[12px] text-text-faint">{{ t('projects.noMcp') }}</div>
            <div v-else class="mt-2 flex flex-wrap gap-1.5">
              <RouterLink
                v-for="m in overview.mcpServers"
                :key="m"
                :to="`/mcp?scope=${encodeURIComponent(mcpScope)}`"
                class="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-dim transition-colors hover:bg-surface-2"
              >
                {{ m }}
              </RouterLink>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

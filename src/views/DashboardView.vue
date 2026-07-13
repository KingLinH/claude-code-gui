<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useProjectsStore } from '@/stores/projects'
import { useSessionsStore } from '@/stores/sessions'
import { fmtBytes, fmtCost, fmtTime, fmtTokens, relTime } from '@/utils/format'
import { t } from '@/i18n'
import type { HealthResponse } from '@shared/types'

const projects = useProjectsStore()
const sessions = useSessionsStore()
const health = ref<HealthResponse | null>(null)
const healthError = ref<string | null>(null)

type Stats = Awaited<ReturnType<typeof api.stats>>
const stats = ref<Stats | null>(null)

onMounted(async () => {
  try {
    health.value = await api.health()
  } catch (e) {
    healthError.value = (e as Error).message
  }
  await Promise.all([projects.fetch(), sessions.fetchLive()])
  try {
    stats.value = await api.stats()
  } catch {
    /* optional */
  }
})

const totalSessions = computed(() => projects.list.reduce((a, p) => a + p.sessionCount, 0))
const totalSize = computed(() => projects.list.reduce((a, p) => a + p.totalSizeBytes, 0))

const tiles = computed(() => [
  { label: t('dashboard.projects'), value: projects.list.length },
  { label: t('dashboard.sessions'), value: totalSessions.value },
  { label: t('dashboard.transcriptSize'), value: fmtBytes(totalSize.value) },
  { label: t('dashboard.liveNow'), value: sessions.live.length },
])

const usageTiles = computed(() => {
  if (!stats.value) return []
  const tot = stats.value.totals
  return [
    { label: t('dashboard.inputTokens'), value: fmtTokens(tot.inputTokens) },
    { label: t('dashboard.outputTokens'), value: fmtTokens(tot.outputTokens) },
    { label: t('dashboard.costLast'), value: fmtCost(tot.cost) },
    { label: t('dashboard.lines'), value: `+${tot.linesAdded} / −${tot.linesRemoved}` },
  ]
})

const topProjects = computed(() => {
  if (!stats.value) return []
  return [...stats.value.projects]
    .filter((p) => (p.lastTotalInputTokens ?? 0) > 0)
    .sort((a, b) => (b.lastTotalInputTokens ?? 0) - (a.lastTotalInputTokens ?? 0))
    .slice(0, 6)
})
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <h1 class="text-[18px] font-semibold">{{ t('dashboard.title') }}</h1>

      <!-- stat tiles -->
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          v-for="st in tiles"
          :key="st.label"
          class="rounded-lg border border-border bg-surface px-4 py-3"
        >
          <div class="text-[22px] font-semibold tabular-nums">{{ st.value }}</div>
          <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ st.label }}</div>
        </div>
      </div>

      <!-- health -->
      <section class="mt-6 rounded-lg border border-border bg-surface p-4">
        <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('dashboard.bridge') }}</div>
        <div v-if="healthError" class="mt-2 text-[13px] text-danger">
          {{ t('dashboard.bridgeError', { msg: healthError }) }}
        </div>
        <dl v-else-if="health" class="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
          <div class="flex justify-between gap-3">
            <dt class="text-text-faint">{{ t('dashboard.claudeDir') }}</dt>
            <dd class="truncate font-mono text-text-dim" :title="health.claudeDir">{{ health.claudeDir }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-text-faint">{{ t('dashboard.platform') }}</dt>
            <dd class="font-mono text-text-dim">{{ health.platform }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-text-faint">{{ t('dashboard.node') }}</dt>
            <dd class="font-mono text-text-dim">{{ health.nodeVersion }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-text-faint">{{ t('dashboard.stateFile') }}</dt>
            <dd class="truncate font-mono text-text-dim" :title="health.dotClaudeJson">{{ health.dotClaudeJson }}</dd>
          </div>
        </dl>
      </section>

      <!-- usage (last-session totals summed across projects) -->
      <section v-if="usageTiles.length" class="mt-6">
        <div class="flex items-baseline gap-2">
          <span class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('dashboard.usage') }}</span>
          <span class="text-[11px] text-text-faint/70">{{ t('dashboard.usageSub') }}</span>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="u in usageTiles"
            :key="u.label"
            class="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div class="text-[20px] font-semibold tabular-nums text-accent">{{ u.value }}</div>
            <div class="mt-0.5 text-[11px] uppercase tracking-wide text-text-faint">{{ u.label }}</div>
          </div>
        </div>

        <div v-if="topProjects.length" class="mt-3 space-y-1">
          <div
            v-for="p in topProjects"
            :key="p.path"
            class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"
          >
            <span class="truncate text-text" :title="p.path">{{ p.path }}</span>
            <span class="ml-auto shrink-0 font-mono text-[12px] text-text-dim">
              {{ fmtTokens(p.lastTotalInputTokens) }} in · {{ fmtTokens(p.lastTotalOutputTokens) }} out
            </span>
            <span class="shrink-0 font-mono text-[12px] text-success">{{ fmtCost(p.lastCost) }}</span>
          </div>
        </div>
      </section>

      <!-- live sessions -->
      <section class="mt-6">
        <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('dashboard.liveSessions') }}</div>
        <div class="mt-2 space-y-1">
          <div
            v-for="l in sessions.live"
            :key="l.pid"
            class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"
          >
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              :class="l.status === 'busy' ? 'bg-success' : 'bg-text-faint'"
            />
            <span class="font-mono text-text-dim">pid {{ l.pid }}</span>
            <span class="truncate text-text" :title="l.cwd">{{ l.cwd || l.name || '—' }}</span>
            <span class="ml-auto text-[11px] text-text-faint">
              {{ l.status }} · {{ relTime(l.updatedAt) }}
            </span>
            <RouterLink
              v-if="l.encoded && l.sessionId && l.hasTranscript"
              :to="{ name: 'session', params: { encoded: l.encoded, id: l.sessionId } }"
              class="text-[12px] text-accent hover:underline"
            >
              {{ t('common.open') }}
            </RouterLink>
          </div>
          <div v-if="!sessions.live.length" class="px-1 py-2 text-[13px] text-text-faint">
            {{ t('dashboard.noLive') }}
          </div>
        </div>
      </section>

      <!-- recent projects -->
      <section class="mt-6">
        <div class="text-[11px] uppercase tracking-wider text-text-faint">{{ t('dashboard.projectsSection') }}</div>
        <div class="mt-2 space-y-1">
          <RouterLink
            v-for="p in projects.list.slice(0, 8)"
            :key="p.encoded"
            :to="{ name: 'sessions' }"
            class="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] transition-colors hover:bg-surface-2"
          >
            <span class="truncate text-text" :title="p.cwd">{{ p.cwd || p.encoded }}</span>
            <span class="ml-auto text-[11px] text-text-faint">
              {{ p.sessionCount }} · {{ fmtTime(p.lastActivityMs) }}
            </span>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

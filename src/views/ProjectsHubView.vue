<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NDataTable, NSpin, type DataTableColumns } from 'naive-ui'
import { useProjectsStore } from '@/stores/projects'
import { useSessionsStore } from '@/stores/sessions'
import { api } from '@/api/client'
import { fmtCost, fmtTokens, relTime } from '@/utils/format'
import { t } from '@/i18n'

const projects = useProjectsStore()
const sessions = useSessionsStore()
const router = useRouter()
const stats = ref<Awaited<ReturnType<typeof api.stats>> | null>(null)

interface Row {
  encoded: string
  cwd: string
  sessionCount: number
  lastActivityMs?: number
  lastCost?: number
  lastTokens?: number
  live: boolean
}

const rows = computed<Row[]>(() => {
  const byCwd = new Map((stats.value?.projects ?? []).map((p) => [p.path, p]))
  return projects.list.map((p) => {
    const s = byCwd.get(p.cwd.replace(/\\/g, '/'))
    return {
      encoded: p.encoded,
      cwd: p.cwd,
      sessionCount: p.sessionCount,
      lastActivityMs: p.lastActivityMs,
      lastCost: s?.lastCost,
      lastTokens: s?.lastTotalInputTokens,
      live: sessions.live.some((l) => l.encoded === p.encoded),
    }
  })
})

const columns = computed<DataTableColumns<Row>>(() => [
  { title: t('projects.col.project'), key: 'cwd', render: (r) => r.cwd, sorter: (a, b) => a.cwd.localeCompare(b.cwd) },
  { title: t('projects.col.sessions'), key: 'sessionCount', render: (r) => r.sessionCount, sorter: (a, b) => a.sessionCount - b.sessionCount },
  { title: t('projects.col.cost'), key: 'lastCost', render: (r) => fmtCost(r.lastCost), sorter: (a, b) => (a.lastCost ?? 0) - (b.lastCost ?? 0) },
  { title: t('projects.col.tokens'), key: 'lastTokens', render: (r) => fmtTokens(r.lastTokens), sorter: (a, b) => (a.lastTokens ?? 0) - (b.lastTokens ?? 0) },
  {
    title: t('projects.col.activity'),
    key: 'lastActivityMs',
    render: (r) => relTime(r.lastActivityMs),
    sorter: (a, b) => (a.lastActivityMs ?? 0) - (b.lastActivityMs ?? 0),
  },
  {
    title: t('projects.col.live'),
    key: 'live',
    render: (r) => (r.live ? h('span', { class: 'inline-block h-1.5 w-1.5 rounded-full bg-success' }) : ''),
  },
])

const rowProps = (row: Row) => ({
  style: 'cursor: pointer',
  onClick: () => router.push(`/projects/${row.encoded}`),
})

onMounted(async () => {
  await Promise.all([projects.fetch(), sessions.fetchLive()])
  try {
    stats.value = await api.stats()
  } catch {
    /* optional */
  }
})
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <div class="flex items-baseline gap-3">
        <h1 class="text-[18px] font-semibold">{{ t('projects.title') }}</h1>
        <span class="text-[12px] text-text-faint">{{ t('projects.count', { n: projects.list.length }) }}</span>
      </div>
      <div v-if="projects.loading" class="py-10 text-text-faint"><NSpin /></div>
      <div v-else-if="!projects.list.length" class="py-10 text-text-faint">{{ t('projects.noProjects') }}</div>
      <div v-else class="mt-4">
        <NDataTable :columns="columns" :data="rows" :row-props="rowProps" :bordered="false" :pagination="false" size="small" />
      </div>
    </div>
  </div>
</template>

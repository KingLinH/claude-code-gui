<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, NInput, NModal, useDialog, useMessage } from 'naive-ui'
import { CreateOutline, PlayOutline, TrashOutline } from '@vicons/ionicons5'
import { useProjectsStore } from '@/stores/projects'
import { useSessionsStore } from '@/stores/sessions'
import { api } from '@/api/client'
import { fmtBytes, fmtDuration, relTime } from '@/utils/format'
import { t } from '@/i18n'
import type { SessionSummary } from '@shared/types'

const projects = useProjectsStore()
const sessions = useSessionsStore()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

// selected project is URL-driven so back/refresh restore it
const selected = computed(() => (route.params.encoded as string) || '')

// rename modal state
const renameShow = ref(false)
const renameTarget = ref<SessionSummary | null>(null)
const renameValue = ref('')
const renaming = ref(false)

function goProject(enc: string) {
  router.push(`/sessions/${enc}`)
}

onMounted(async () => {
  await Promise.all([projects.fetch(), sessions.fetchLive()])
  const enc = (route.params.encoded as string) || ''
  if (enc) {
    await sessions.fetchSessions(enc)
  } else if (projects.list.length) {
    router.replace(`/sessions/${projects.list[0].encoded}`)
  }
})

watch(
  () => route.params.encoded,
  async (enc) => {
    if (enc) await sessions.fetchSessions(enc as string)
  },
)

function open(enc: string, id: string) {
  router.push({ name: 'session', params: { encoded: enc, id } })
}

function startRename(s: SessionSummary) {
  renameTarget.value = s
  renameValue.value = s.aiTitle || s.lastPrompt?.slice(0, 90) || ''
  renameShow.value = true
}

async function confirmRename() {
  const s = renameTarget.value
  const title = renameValue.value.trim()
  if (!s || !title) return false
  renaming.value = true
  try {
    await sessions.rename(selected.value, s.sessionId, title)
    message.success(t('sessions.renamed'))
    return true
  } catch (e) {
    message.error((e as Error).message)
    return false
  } finally {
    renaming.value = false
  }
}

function confirmDelete(s: SessionSummary) {
  dialog.warning({
    title: t('sessions.deleteTitle'),
    content: t('sessions.deleteContent', { title: s.aiTitle || s.sessionId.slice(0, 8) }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await sessions.remove(selected.value, s.sessionId)
        message.success(t('sessions.deleted'))
      } catch (e) {
        message.error((e as Error).message)
      }
    },
  })
}

function titleOf(s: SessionSummary) {
  return s.aiTitle || s.lastPrompt?.slice(0, 90) || s.sessionId.slice(0, 8)
}

async function resume(s: SessionSummary) {
  try {
    await api.resumeSession(selected.value, s.sessionId)
    message.success(t('resume.launched'))
  } catch (e) {
    message.error((e as Error).message)
  }
}
</script>

<template>
  <div class="flex h-full">
    <!-- projects rail -->
    <div class="w-[300px] shrink-0 overflow-auto border-r border-border">
      <div class="px-4 py-3 text-[11px] uppercase tracking-wider text-text-faint">{{ t('sessions.projects') }}</div>
      <button
        v-for="p in projects.list"
        :key="p.encoded"
        class="block w-full border-l-2 px-4 py-2 text-left transition-colors hover:bg-surface-2"
        :class="selected === p.encoded ? 'border-accent bg-surface-2' : 'border-transparent'"
        @click="goProject(p.encoded)"
      >
        <div class="truncate text-[13px] font-medium" :title="p.cwd">{{ p.cwd || p.encoded }}</div>
        <div class="mt-0.5 text-[11px] text-text-faint">
          {{ t('sessions.sessionsCount', { n: p.sessionCount }) }} · {{ fmtBytes(p.totalSizeBytes) }}
        </div>
      </button>
      <div v-if="!projects.list.length && !projects.loading" class="px-4 py-6 text-[12px] text-text-faint">
        {{ t('sessions.noProjects') }}
      </div>
    </div>

    <!-- sessions -->
    <div class="min-w-0 flex-1 overflow-auto">
      <div class="px-6 py-3 text-[11px] uppercase tracking-wider text-text-faint">{{ t('sessions.sessions') }}</div>

      <div v-if="!selected" class="px-6 py-10 text-text-faint">{{ t('sessions.selectProject') }}</div>
      <div v-else-if="sessions.loadingProject[selected]" class="px-6 py-10 text-text-faint">{{ t('sessions.loading') }}</div>
      <div v-else-if="!sessions.byProject[selected]?.length" class="px-6 py-10 text-text-faint">
        {{ t('sessions.noSessions') }}
      </div>

      <div v-else class="space-y-1 px-3 py-1">
        <div
          v-for="s in sessions.byProject[selected]"
          :key="s.sessionId"
          class="group flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-surface"
          @click="open(selected, s.sessionId)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                v-if="sessions.isLive(selected, s.sessionId)"
                class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success"
              />
              <span class="truncate text-[13.5px] font-medium">{{ titleOf(s) }}</span>
            </div>
            <div class="mt-1 flex flex-wrap gap-x-3 text-[11px] text-text-faint">
              <span>{{ t('sessions.msgs', { n: s.messageCount }) }}</span>
              <span v-if="s.durationMs">⏱ {{ fmtDuration(s.durationMs) }}</span>
              <span>{{ fmtBytes(s.sizeBytes) }}</span>
              <span>{{ relTime(s.lastTs || s.mtimeMs) }}</span>
              <span v-if="s.hasSubagents" class="text-accent">⊕ {{ t('sessions.subagents') }}</span>
              <span v-if="s.malformedCount" class="text-warning">⚠ {{ s.malformedCount }}</span>
            </div>
          </div>

          <!-- row actions: color-coded, dimmed until hover -->
          <div class="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            <button
              class="rounded p-1 text-accent transition-colors hover:bg-accent/15"
              :title="t('resume.run')"
              @click.stop="resume(s)"
            >
              <NIcon :component="PlayOutline" :size="16" />
            </button>
            <button
              class="rounded p-1 text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              :title="t('sessions.rename')"
              @click.stop="startRename(s)"
            >
              <NIcon :component="CreateOutline" :size="16" />
            </button>
            <button
              class="rounded p-1 text-danger transition-colors hover:bg-danger/15"
              :title="t('common.delete')"
              @click.stop="confirmDelete(s)"
            >
              <NIcon :component="TrashOutline" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- rename modal -->
    <NModal
      v-model:show="renameShow"
      :title="t('sessions.renameTitle')"
      preset="dialog"
      :show-icon="false"
      :positive-text="t('common.save')"
      :negative-text="t('common.cancel')"
      :loading="renaming"
      @positive-click="confirmRename"
    >
      <NInput v-model:value="renameValue" v-select-all :placeholder="t('sessions.namePlaceholder')" autofocus />
    </NModal>
  </div>
</template>

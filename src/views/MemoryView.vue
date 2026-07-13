<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NInput, NSelect, NSpin, NTag, useDialog, useMessage } from 'naive-ui'
import { AddOutline, CreateOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5'
import { useProjectsStore } from '@/stores/projects'
import { useMemoryStore } from '@/stores/memory'
import { useUrlQuery } from '@/composables/useUrlQuery'
import MarkdownBlock from '@/components/transcript/MarkdownBlock.vue'
import { relTime } from '@/utils/format'
import { t } from '@/i18n'

const projects = useProjectsStore()
const store = useMemoryStore()
const message = useMessage()
const dialog = useDialog()

const { value: selectedProject, set: setSelectedProject } = useUrlQuery('project')
const { value: selectedSlug, set: setSelectedSlug } = useUrlQuery('slug')
const editing = ref(false)
const draft = ref('')
const dirty = ref(false)

const files = computed(() =>
  selectedProject.value ? store.byProject[selectedProject.value]?.files ?? [] : [],
)

const projectOptions = computed(() =>
  projects.list.map((p) => ({ label: p.cwd || p.encoded, value: p.encoded })),
)

onMounted(async () => {
  await projects.fetch()
  if (selectedProject.value) {
    await store.fetchList(selectedProject.value)
  } else if (projects.list[0]) {
    setSelectedProject(projects.list[0].encoded)
  }
  if (selectedSlug.value && selectedProject.value) {
    store.fetchDetail(selectedProject.value, selectedSlug.value)
  }
})

watch(selectedProject, async (enc) => {
  if (!enc) return
  setSelectedSlug('')
  store.detail = null
  await store.fetchList(enc)
})

watch(selectedSlug, (slug) => {
  if (slug && selectedProject.value) store.fetchDetail(selectedProject.value, slug)
})

function open(slug: string) {
  editing.value = false
  setSelectedSlug(slug)
}

function startEdit() {
  draft.value = store.detail?.raw ?? ''
  editing.value = true
  dirty.value = false
}

function touch() {
  dirty.value = true
}

async function save() {
  if (!selectedProject.value || !selectedSlug.value) return
  try {
    await store.save(selectedProject.value, selectedSlug.value, draft.value)
    message.success(t('common.saved') + (store.lastBackup ? ` · ${t('common.backupWritten')}` : ''))
    editing.value = false
    dirty.value = false
    await store.fetchDetail(selectedProject.value, selectedSlug.value)
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function createNew() {
  if (!selectedProject.value) return
  const slug = window.prompt(t('memory.slugPrompt'))?.trim()
  if (!slug) return
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
    message.error(t('memory.slugInvalid'))
    return
  }
  const content = `---\nname: ${slug}\ndescription: \nmetadata:\n  type: project\n---\n\n`
  try {
    await store.create(selectedProject.value, slug, content)
    message.success(t('memory.created'))
    setSelectedSlug(slug)
    await store.fetchDetail(selectedProject.value, slug)
    draft.value = content
    editing.value = true
    dirty.value = false
  } catch (e) {
    message.error((e as Error).message)
  }
}

function remove() {
  if (!selectedSlug.value || !selectedProject.value) return
  dialog.warning({
    title: t('memory.deleteTitle'),
    content: t('memory.deleteContent', { slug: selectedSlug.value }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      await store.remove(selectedProject.value, selectedSlug.value)
      message.success(t('memory.deleted'))
      setSelectedSlug('')
      store.detail = null
    },
  })
}
</script>

<template>
  <div class="flex h-full">
    <!-- rail -->
    <div class="w-[340px] shrink-0 overflow-auto border-r border-border">
      <div class="flex items-center gap-2 p-3">
        <NSelect
          v-model:value="selectedProject"
          :options="projectOptions"
          size="small"
          class="flex-1"
        />
        <NButton size="small" quaternary @click="createNew" :title="t('memory.new')">
          <template #icon><NIcon :component="AddOutline" /></template>
        </NButton>
      </div>
      <div v-if="!files.length && !store.loading" class="px-3 py-4 text-[12px] text-text-faint">
        {{ t('memory.noMemories') }}
      </div>
      <button
        v-for="f in files"
        :key="f.slug"
        class="block w-full border-l-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
        :class="selectedSlug === f.slug ? 'border-accent bg-surface-2' : 'border-transparent'"
        @click="open(f.slug)"
      >
        <div class="flex items-center gap-2">
          <span class="truncate text-[13px] font-medium">{{ f.title || f.name || f.slug }}</span>
          <NTag v-if="f.type" size="tiny" class="ml-auto shrink-0">{{ f.type }}</NTag>
        </div>
        <div class="truncate text-[11.5px] text-text-faint">
          {{ f.summary || f.description || f.slug }}
        </div>
      </button>
    </div>

    <!-- detail -->
    <div class="min-w-0 flex-1 overflow-auto">
      <div v-if="!selectedSlug" class="p-10 text-text-faint">{{ t('memory.selectPrompt') }}</div>
      <div v-else-if="store.loadingDetail" class="p-10 text-text-faint"><NSpin /></div>
      <div v-else-if="!store.detail" class="p-10 text-text-faint">{{ t('common.noContent') }}</div>
      <div v-else class="content-col px-6 py-6">
        <!-- header -->
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-[18px] font-semibold">{{ store.detail.frontmatter.name || selectedSlug }}</h1>
          <div class="ml-auto flex items-center gap-1">
            <NButton v-if="!editing" size="small" quaternary @click="startEdit">
              <template #icon><NIcon :component="CreateOutline" /></template>
              {{ t('common.edit') }}
            </NButton>
            <template v-else>
              <NButton size="small" type="primary" :disabled="!dirty || store.saving" :loading="store.saving" @click="save">
                <template #icon><NIcon :component="SaveOutline" /></template>
                {{ t('common.save') }}
              </NButton>
              <NButton size="small" quaternary :disabled="store.saving" @click="editing = false">{{ t('common.cancel') }}</NButton>
            </template>
            <NButton size="small" quaternary :disabled="store.saving" @click="remove">
              <template #icon><NIcon :component="TrashOutline" /></template>
            </NButton>
          </div>
        </div>
        <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-faint">
          <span class="font-mono">{{ selectedSlug }}.md</span>
          <NTag v-if="store.detail.frontmatter.metadata && (store.detail.frontmatter.metadata as Record<string, unknown>).type" size="tiny">
            {{ (store.detail.frontmatter.metadata as Record<string, unknown>).type }}
          </NTag>
          <span>{{ relTime(store.detail.mtimeMs) }}</span>
        </div>

        <!-- body -->
        <div v-if="store.detail.frontmatter.description" class="mt-3 text-[13px] text-text-dim">
          {{ store.detail.frontmatter.description }}
        </div>

        <div v-if="!editing" class="mt-5 border-t border-border pt-5">
          <MarkdownBlock :content="store.detail.body || t('memory.empty')" />
        </div>
        <div v-else class="mt-4">
          <div class="mb-1 text-[11px] uppercase tracking-wide text-text-faint">{{ t('memory.raw') }}</div>
          <NInput
            v-model:value="draft"
            type="textarea"
            :autosize="{ minRows: 14, maxRows: 32 }"
            class="font-mono"
            @update:value="touch"
          />
        </div>
      </div>
    </div>
  </div>
</template>

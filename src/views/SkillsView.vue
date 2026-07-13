<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NInput, NModal, NSpin, NTag, useDialog, useMessage } from 'naive-ui'
import { AddOutline, CreateOutline, SaveOutline, SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { useSkillsStore } from '@/stores/skills'
import { useUrlQuery } from '@/composables/useUrlQuery'
import MarkdownBlock from '@/components/transcript/MarkdownBlock.vue'
import { t } from '@/i18n'

const store = useSkillsStore()
const message = useMessage()
const dialog = useDialog()
const { value: selectedId, set: setSelectedId } = useUrlQuery('skill')
const q = ref('')

const editing = ref(false)
const draft = ref('')
const dirty = ref(false)

const newShow = ref(false)
const newName = ref('')
const creating = ref(false)

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return store.list
  return store.list.filter(
    (x) => x.name.toLowerCase().includes(s) || x.description.toLowerCase().includes(s),
  )
})

const currentInfo = computed(() => store.list.find((s) => s.id === selectedId.value))
const isPlugin = computed(() => {
  const k = currentInfo.value?.source.kind
  return k === 'plugin' || k === 'external'
})

function projectTail(p?: string): string {
  if (!p) return ''
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p
}

const fmName = computed(() => String(store.detail?.frontmatter?.name ?? 'skill'))
const fmDesc = computed(() => String(store.detail?.frontmatter?.description ?? ''))
const fmVersion = computed(() =>
  store.detail?.frontmatter?.version != null ? String(store.detail.frontmatter.version) : '',
)

function select(id: string) {
  editing.value = false
  setSelectedId(id)
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
  if (!selectedId.value) return
  try {
    await store.save(selectedId.value, draft.value)
    message.success(t('skills.saved'))
    editing.value = false
    dirty.value = false
  } catch (e) {
    message.error((e as Error).message)
  }
}

function openNew() {
  newName.value = ''
  newShow.value = true
}

async function confirmCreate() {
  const name = newName.value.trim()
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    message.error(t('skills.nameInvalid'))
    return false
  }
  creating.value = true
  try {
    const r = await store.create(name, '')
    message.success(t('skills.created'))
    select(r.id)
    return true
  } catch (e) {
    message.error((e as Error).message)
    return false
  } finally {
    creating.value = false
  }
}

function confirmDelete() {
  const info = currentInfo.value
  if (!info) return
  dialog.warning({
    title: t('skills.deleteTitle'),
    content: t('skills.deleteContent', { name: info.name }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await store.remove(selectedId.value)
        message.success(t('skills.deleted'))
        setSelectedId('')
      } catch (e) {
        message.error((e as Error).message)
      }
    },
  })
}

watch(selectedId, (id) => {
  if (id) store.fetchDetail(id)
})

onMounted(async () => {
  await store.fetch()
  if (selectedId.value) store.fetchDetail(selectedId.value)
})
</script>

<template>
  <div class="flex h-full">
    <!-- rail -->
    <div class="w-[320px] shrink-0 overflow-auto border-r border-border">
      <div class="p-3">
        <div class="flex items-center gap-2">
          <NInput v-model:value="q" :placeholder="t('skills.searchPlaceholder')" size="small" clearable class="flex-1">
            <template #prefix><NIcon :component="SearchOutline" /></template>
          </NInput>
          <NButton size="small" quaternary :title="t('skills.new')" @click="openNew">
            <template #icon><NIcon :component="AddOutline" /></template>
          </NButton>
        </div>
        <div class="mt-1 text-[11px] text-text-faint">{{ t('skills.count', { n: store.list.length }) }}</div>
      </div>
      <button
        v-for="s in filtered"
        :key="s.id"
        class="block w-full border-l-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
        :class="selectedId === s.id ? 'border-accent bg-surface-2' : 'border-transparent'"
        @click="select(s.id)"
      >
        <div class="flex items-center gap-2">
          <span class="truncate text-[13px] font-medium">{{ s.name }}</span>
          <span class="ml-auto shrink-0 text-[10px] text-text-faint">
            <span class="uppercase">{{ s.source.kind }}</span>
            <span v-if="s.source.kind === 'project' && s.source.project" class="text-text-faint/70"> · {{ projectTail(s.source.project) }}</span>
          </span>
        </div>
        <div class="truncate text-[11.5px] text-text-faint">{{ s.description }}</div>
      </button>
      <div v-if="store.loading" class="px-3 py-6 text-[12px] text-text-faint"><NSpin :size="14" /></div>
    </div>

    <!-- detail -->
    <div class="min-w-0 flex-1 overflow-auto">
      <div v-if="!selectedId" class="p-10 text-text-faint">{{ t('skills.selectPrompt') }}</div>
      <div v-else-if="store.loadingDetail" class="p-10 text-text-faint"><NSpin /></div>
      <div v-else-if="!store.detail" class="p-10 text-text-faint">{{ t('skills.noDetail') }}</div>
      <div v-else class="content-col px-6 py-6">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-[18px] font-semibold">{{ fmName }}</h1>
          <div class="ml-auto flex items-center gap-1">
            <template v-if="!editing">
              <NButton size="small" quaternary @click="startEdit">
                <template #icon><NIcon :component="CreateOutline" /></template>
                {{ t('skills.edit') }}
              </NButton>
              <NButton size="small" quaternary @click="confirmDelete">
                <template #icon><NIcon :component="TrashOutline" /></template>
                {{ t('common.delete') }}
              </NButton>
            </template>
            <template v-else>
              <NButton size="small" type="primary" :disabled="!dirty || store.saving" :loading="store.saving" @click="save">
                <template #icon><NIcon :component="SaveOutline" /></template>
                {{ t('common.save') }}
              </NButton>
              <NButton size="small" quaternary :disabled="store.saving" @click="editing = false">{{ t('common.cancel') }}</NButton>
            </template>
          </div>
        </div>
        <div v-if="fmDesc && !editing" class="mt-1 text-[13px] text-text-dim">{{ fmDesc }}</div>

        <div v-if="isPlugin" class="mt-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-1.5 text-[12px] text-warning">
          {{ t('skills.pluginWarn') }}
        </div>

        <div v-if="!editing" class="mt-3 flex flex-wrap gap-2">
          <NTag v-if="fmVersion" size="small">v{{ fmVersion }}</NTag>
          <NTag v-if="store.detail.siblings.scripts.length" size="small">
            {{ t('skills.scripts') }}: {{ store.detail.siblings.scripts.length }}
          </NTag>
          <NTag v-if="store.detail.siblings.references.length" size="small">
            {{ t('skills.refs') }}: {{ store.detail.siblings.references.length }}
          </NTag>
        </div>
        <div v-if="!editing" class="mt-2 break-all font-mono text-[11px] text-text-faint">{{ store.detail.relPath }}</div>

        <div v-if="!editing" class="mt-5 border-t border-border pt-5">
          <MarkdownBlock :content="store.detail.body" />
        </div>
        <div v-else class="mt-4">
          <div class="mb-1 text-[11px] uppercase tracking-wide text-text-faint">{{ t('skills.raw') }}</div>
          <NInput
            v-model:value="draft"
            type="textarea"
            :autosize="{ minRows: 14, maxRows: 36 }"
            class="font-mono"
            @update:value="touch"
          />
        </div>
      </div>
    </div>

    <!-- new skill modal -->
    <NModal
      v-model:show="newShow"
      :title="t('skills.new')"
      preset="dialog"
      :show-icon="false"
      :positive-text="t('common.add')"
      :negative-text="t('common.cancel')"
      :loading="creating"
      @positive-click="confirmCreate"
    >
      <NInput v-model:value="newName" :placeholder="t('skills.namePrompt')" autofocus />
    </NModal>
  </div>
</template>

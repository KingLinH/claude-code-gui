<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NSpin, useMessage } from 'naive-ui'
import { CreateOutline, SaveOutline } from '@vicons/ionicons5'
import { usePlansStore } from '@/stores/plans'
import { useUrlQuery } from '@/composables/useUrlQuery'
import { api } from '@/api/client'
import MarkdownBlock from '@/components/transcript/MarkdownBlock.vue'
import { fmtBytes, relTime } from '@/utils/format'
import { t } from '@/i18n'

const store = usePlansStore()
const message = useMessage()
const { value: selected, set: setSelected } = useUrlQuery('plan')
const editing = ref(false)
const draft = ref('')
const dirty = ref(false)

function open(file: string) {
  setSelected(file)
  editing.value = false
}

function startEdit() {
  draft.value = store.detail?.body ?? ''
  editing.value = true
  dirty.value = false
}

function touch() {
  dirty.value = true
}

async function save() {
  if (!selected.value) return
  try {
    await api.savePlan(selected.value, draft.value)
    message.success(t('plans.saved'))
    editing.value = false
    dirty.value = false
    await store.fetchDetail(selected.value)
  } catch (e) {
    message.error((e as Error).message)
  }
}

watch(selected, (file) => {
  if (file) store.fetchDetail(file)
})

onMounted(async () => {
  await store.fetch()
  if (selected.value) store.fetchDetail(selected.value)
})
</script>

<template>
  <div class="flex h-full">
    <!-- rail -->
    <div class="w-[320px] shrink-0 overflow-auto border-r border-border">
      <div class="px-4 py-3 text-[11px] uppercase tracking-wider text-text-faint">
        {{ t('plans.count', { n: store.list.length }) }}
      </div>
      <button
        v-for="p in store.list"
        :key="p.file"
        class="block w-full border-l-2 px-4 py-2 text-left transition-colors hover:bg-surface-2"
        :class="selected === p.file ? 'border-accent bg-surface-2' : 'border-transparent'"
        @click="open(p.file)"
      >
        <div class="truncate text-[13px] font-medium">{{ p.title }}</div>
        <div class="mt-0.5 flex gap-2 text-[11px] text-text-faint">
          <span>{{ relTime(p.mtimeMs) }}</span>
          <span>· {{ fmtBytes(p.sizeBytes) }}</span>
        </div>
      </button>
      <div v-if="!store.list.length && !store.loading" class="px-4 py-6 text-[12px] text-text-faint">
        {{ t('plans.noPlans') }}
      </div>
    </div>

    <!-- reader -->
    <div class="min-w-0 flex-1 overflow-auto">
      <div v-if="!selected" class="p-10 text-text-faint">{{ t('plans.selectPrompt') }}</div>
      <div v-else-if="store.loadingDetail" class="p-10 text-text-faint"><NSpin /></div>
      <div v-else-if="!store.detail" class="p-10 text-text-faint">{{ t('common.noContent') }}</div>
      <div v-else class="content-col px-6 py-6">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-[18px] font-semibold">{{ store.detail.file }}</h1>
          <div class="ml-auto flex items-center gap-1">
            <template v-if="!editing">
              <NButton size="small" quaternary @click="startEdit">
                <template #icon><NIcon :component="CreateOutline" /></template>
                {{ t('common.edit') }}
              </NButton>
            </template>
            <template v-else>
              <NButton size="small" type="primary" :disabled="!dirty" @click="save">
                <template #icon><NIcon :component="SaveOutline" /></template>
                {{ t('common.save') }}
              </NButton>
              <NButton size="small" quaternary @click="editing = false">{{ t('common.cancel') }}</NButton>
            </template>
          </div>
        </div>

        <div v-if="!editing" class="mt-5 border-t border-border pt-5">
          <MarkdownBlock :content="store.detail.body" />
        </div>
        <div v-else class="mt-4">
          <NInput
            v-model:value="draft"
            type="textarea"
            :autosize="{ minRows: 18, maxRows: 40 }"
            class="font-mono"
            @update:value="touch"
          />
        </div>
      </div>
    </div>
  </div>
</template>

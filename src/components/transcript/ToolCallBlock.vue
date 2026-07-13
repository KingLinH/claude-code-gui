<script setup lang="ts">
import { computed, ref } from 'vue'
import { NIcon } from 'naive-ui'
import {
  ChevronDownOutline,
  ChevronForwardOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from '@vicons/ionicons5'
import type { ToolCall } from '@shared/types'
import DiffViewer from './DiffViewer.vue'
import CodeBlock from './CodeBlock.vue'
import ToolResultBlock from './ToolResultBlock.vue'
import SubagentThread from './SubagentThread.vue'

const props = defineProps<{ call: ToolCall; encoded?: string; sessionId?: string }>()
const open = ref(false)

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const filePath = computed(() => str(props.call.input.file_path))
const command = computed(() => str(props.call.input.command))
const pattern = computed(() => str(props.call.input.pattern) || str(props.call.input.glob))
const oldStr = computed(() => str(props.call.input.old_string))
const newStr = computed(() => str(props.call.input.new_string))
const content = computed(() => str(props.call.input.content))
const edits = computed(() => (Array.isArray(props.call.input.edits) ? (props.call.input.edits as unknown[]) : []))
const jsonInput = computed(() => JSON.stringify(props.call.input, null, 2))
const ext = computed(() => {
  const m = /\.([A-Za-z0-9]+)$/.exec(filePath.value)
  return m ? m[1] : ''
})
const resultLines = computed(() =>
  props.call.result ? (props.call.result.content.match(/\n/g)?.length ?? 0) + 1 : 0,
)

const summaryText = computed(() => {
  switch (props.call.name) {
    case 'Edit':
    case 'Write':
    case 'Read':
    case 'MultiEdit':
      return filePath.value
    case 'Bash':
      return command.value
    case 'Grep':
    case 'Glob':
      return pattern.value
    case 'Task':
    case 'Agent':
      return str(props.call.input.description) || str(props.call.input.subagent_type) || ''
    case 'WebSearch':
    case 'WebFetch':
      return str(props.call.input.query) || str(props.call.input.url) || ''
    default:
      return ''
  }
})

const isEdit = computed(() => props.call.name === 'Edit')
const isMultiEdit = computed(() => props.call.name === 'MultiEdit')
const isWrite = computed(() => props.call.name === 'Write')
const isBash = computed(() => props.call.name === 'Bash')
const isSubagent = computed(() => !!props.call.subagent)
</script>

<template>
  <div class="rounded-lg border border-border bg-surface">
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2"
      @click="open = !open"
    >
      <NIcon
        :component="open ? ChevronDownOutline : ChevronForwardOutline"
        :size="13"
        class="shrink-0 text-text-faint"
      />
      <span class="font-mono font-medium text-accent">{{ call.name }}</span>
      <span v-if="summaryText" class="truncate text-text-dim">· {{ summaryText }}</span>
      <span
        v-if="call.result"
        class="ml-auto flex shrink-0 items-center gap-1 text-[11px]"
        :class="call.result.isError ? 'text-danger' : 'text-text-faint'"
      >
        <NIcon :component="call.result.isError ? CloseCircleOutline : CheckmarkCircleOutline" :size="12" />
        <span>{{ resultLines }}L</span>
      </span>
    </button>

    <div v-if="open" class="space-y-2 border-t border-border px-3 py-2">
      <!-- input, dispatched by tool name -->
      <DiffViewer v-if="isEdit" :old-text="oldStr" :new-text="newStr" :title="filePath" mode="edit" />
      <div v-else-if="isMultiEdit" class="space-y-2">
        <DiffViewer
          v-for="(e, i) in edits"
          :key="i"
          :old-text="str((e as Record<string, unknown>).old_string)"
          :new-text="str((e as Record<string, unknown>).new_string)"
          :title="`${filePath} · edit #${i + 1}`"
          mode="edit"
        />
      </div>
      <CodeBlock v-else-if="isWrite" :code="content" :lang="ext" :title="filePath" />
      <CodeBlock v-else-if="isBash" :code="command" lang="bash" />
      <CodeBlock v-else :code="jsonInput" lang="json" :title="summaryText" />

      <SubagentThread v-if="isSubagent" :call="call" :encoded="encoded" :session-id="sessionId" />
      <ToolResultBlock v-if="call.result" :result="call.result" />
    </div>
  </div>
</template>

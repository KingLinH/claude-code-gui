<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NInput, NSelect, NSpin, useMessage } from 'naive-ui'
import { AddOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5'
import { useMcpStore } from '@/stores/mcp'
import { useUrlQuery } from '@/composables/useUrlQuery'
import type { McpServer } from '@shared/types'
import { relTime } from '@/utils/format'
import { t } from '@/i18n'

interface ServerDraft {
  name: string
  type: 'stdio' | 'sse' | 'http'
  command: string
  argsText: string
  envText: string
  url: string
  extraJson: string
}

const store = useMcpStore()
const message = useMessage()

const GLOBAL = '__global__'
const { value: selected, set: setSelected } = useUrlQuery('scope')
const drafts = ref<ServerDraft[]>([])
const dirty = ref(false)

const typeOptions = [
  { label: 'stdio', value: 'stdio' },
  { label: 'sse', value: 'sse' },
  { label: 'http', value: 'http' },
]

const scopeOptions = computed(() => {
  if (!store.scope) return []
  const opts: Array<{ label: string; value: string }> = [
    { label: t('mcp.scopeGlobal'), value: GLOBAL },
  ]
  for (const p of store.scope.projects) {
    const n = Object.keys(p.mcpServers ?? {}).length
    opts.push({
      label: `${p.path}${p.exists ? '' : ' ' + t('mcp.missing')}${n ? `  · ${n}` : ''}`,
      value: p.path,
    })
  }
  return opts
})

function serversForScope(key: string): Record<string, McpServer> {
  if (!store.scope) return {}
  if (key === GLOBAL) return store.scope.global
  return store.scope.projects.find((p) => p.path === key)?.mcpServers ?? {}
}

function serversToDrafts(servers: Record<string, McpServer>): ServerDraft[] {
  const known = new Set(['command', 'args', 'env', 'type', 'url'])
  return Object.entries(servers).map(([name, s]) => {
    const extra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(s)) if (!known.has(k)) extra[k] = v
    return {
      name,
      type: s.type === 'sse' || s.type === 'http' ? s.type : 'stdio',
      command: s.command ?? '',
      argsText: (s.args ?? []).join('\n'),
      envText: Object.entries(s.env ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join('\n'),
      url: s.url ?? '',
      extraJson: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '',
    }
  })
}

function draftsToServers(list: ServerDraft[]): Record<string, McpServer> {
  const out: Record<string, McpServer> = {}
  for (const d of list) {
    const name = d.name.trim() || 'unnamed'
    const s: McpServer = { type: d.type }
    if (d.type === 'stdio') {
      if (d.command.trim()) s.command = d.command.trim()
      const args = d.argsText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
      if (args.length) s.args = args
    } else {
      if (d.url.trim()) s.url = d.url.trim()
    }
    const env: Record<string, string> = {}
    for (const line of d.envText.split('\n')) {
      const t = line.trim()
      if (!t) continue
      const eq = t.indexOf('=')
      if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1)
    }
    if (Object.keys(env).length) s.env = env
    if (d.extraJson.trim()) {
      try {
        Object.assign(s, JSON.parse(d.extraJson) as Record<string, unknown>)
      } catch {
        /* ignore malformed extra JSON — keep known fields */
      }
    }
    out[name] = s
  }
  return out
}

function loadDrafts(key: string) {
  drafts.value = serversToDrafts(serversForScope(key))
  dirty.value = false
}

function onSelect(key: string) {
  if (dirty.value && !window.confirm(t('mcp.discardConfirm'))) return
  setSelected(key)
}

watch(selected, (k) => {
  if (k) loadDrafts(k)
})

function touch() {
  dirty.value = true
}

function addServer() {
  drafts.value.push({
    name: 'new-server',
    type: 'stdio',
    command: '',
    argsText: '',
    envText: '',
    url: '',
    extraJson: '',
  })
  touch()
}

function removeServer(i: number) {
  drafts.value.splice(i, 1)
  touch()
}

const dupNames = computed(() => {
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const d of drafts.value) {
    const n = d.name.trim()
    if (seen.has(n)) dups.add(n)
    seen.add(n)
  }
  return dups
})

async function save() {
  if (dupNames.value.size) {
    message.warning(t('mcp.dupNames', { names: [...dupNames.value].join(', ') }))
    return
  }
  const servers = draftsToServers(drafts.value)
  try {
    if (selected.value === GLOBAL) await store.saveGlobal(servers)
    else await store.saveProject(selected.value, servers)
    const scope = selected.value === GLOBAL ? t('mcp.toGlobal') : t('mcp.toProject')
    message.success(
      t('mcp.saved', { n: Object.keys(servers).length, scope }) +
        (store.lastBackup ? ` · ${t('common.backupWritten')}` : ''),
      { duration: 5000 },
    )
    dirty.value = false
    loadDrafts(selected.value)
  } catch (e) {
    message.error((e as Error).message)
  }
}

onMounted(async () => {
  await store.fetch()
  if (selected.value) loadDrafts(selected.value)
  else setSelected(GLOBAL)
})
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <!-- header -->
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-[18px] font-semibold">{{ t('mcp.title') }}</h1>
        <div class="ml-auto flex items-center gap-2">
          <NButton
            size="small"
            type="primary"
            :disabled="!dirty || store.saving"
            :loading="store.saving"
            @click="save"
          >
            <template #icon><NIcon :component="SaveOutline" /></template>
            {{ t('common.save') }}
          </NButton>
        </div>
      </div>
      <p class="mt-1 text-[12px] text-text-faint">
        {{ t('mcp.note') }}
      </p>

      <!-- scope selector -->
      <div class="mt-4 flex items-center gap-3">
        <span class="text-[12px] uppercase tracking-wide text-text-faint">{{ t('mcp.scope') }}</span>
        <NSelect
          :value="selected"
          :options="scopeOptions"
          :loading="store.loading"
          size="small"
          class="min-w-[360px] flex-1"
          @update:value="onSelect"
        />
      </div>

      <div v-if="store.lastBackup" class="mt-2 text-[11px] text-text-faint">
        {{ t('mcp.lastBackup') }} <span class="font-mono">{{ store.lastBackup }}</span>
        <span v-if="store.lastSavedAt"> · {{ relTime(store.lastSavedAt) }}</span>
      </div>

      <!-- body -->
      <div v-if="store.loading && !drafts.length" class="py-10 text-text-faint">
        <NSpin :size="16" /> {{ t('common.loading') }}
      </div>
      <div v-else-if="store.error" class="py-6 text-danger">{{ store.error }}</div>

      <div v-else class="mt-4 space-y-3">
        <div
          v-for="(d, i) in drafts"
          :key="i"
          class="rounded-lg border border-border bg-surface p-3"
        >
          <div class="flex items-center gap-2">
            <NInput
              v-model:value="d.name"
              v-select-all
              size="small"
              :placeholder="t('mcp.serverName')"
              class="font-mono"
              :status="dupNames.has(d.name.trim()) ? 'warning' : undefined"
              @update:value="touch"
            />
            <NSelect
              v-model:value="d.type"
              :options="typeOptions"
              size="small"
              class="w-[110px] shrink-0"
              @update:value="touch"
            />
            <button
              class="ml-auto rounded p-1.5 text-text-faint transition-colors hover:bg-surface-2 hover:text-danger"
              title="Remove"
              @click="removeServer(i)"
            >
              <NIcon :component="TrashOutline" :size="15" />
            </button>
          </div>

          <!-- stdio fields -->
          <template v-if="d.type === 'stdio'">
            <div class="mt-2">
              <label class="text-[11px] text-text-faint">{{ t('mcp.command') }}</label>
              <NInput
                v-model:value="d.command"
                size="small"
                placeholder="npx"
                class="font-mono"
                @update:value="touch"
              />
            </div>
            <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label class="text-[11px] text-text-faint">{{ t('mcp.args') }}</label>
                <NInput
                  v-model:value="d.argsText"
                  type="textarea"
                  size="small"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                  placeholder="-y&#10;@modelcontextprotocol/server-filesystem"
                  class="font-mono"
                  @update:value="touch"
                />
              </div>
              <div>
                <label class="text-[11px] text-text-faint">{{ t('mcp.env') }}</label>
                <NInput
                  v-model:value="d.envText"
                  type="textarea"
                  size="small"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                  placeholder="API_KEY=..."
                  class="font-mono"
                  @update:value="touch"
                />
              </div>
            </div>
          </template>

          <!-- sse / http fields -->
          <template v-else>
            <div class="mt-2">
              <label class="text-[11px] text-text-faint">{{ t('mcp.url') }}</label>
              <NInput
                v-model:value="d.url"
                size="small"
                placeholder="https://..."
                class="font-mono"
                @update:value="touch"
              />
            </div>
            <div class="mt-2">
              <label class="text-[11px] text-text-faint">{{ t('mcp.headersEnv') }}</label>
              <NInput
                v-model:value="d.envText"
                type="textarea"
                size="small"
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="Authorization=Bearer ..."
                class="font-mono"
                @update:value="touch"
              />
            </div>
          </template>

          <div class="mt-2">
            <label class="text-[11px] text-text-faint">{{ t('mcp.advanced') }}</label>
            <NInput
              v-model:value="d.extraJson"
              type="textarea"
              size="small"
              :autosize="{ minRows: 1, maxRows: 6 }"
              placeholder='{"headers":{...}}'
              class="font-mono"
              @update:value="touch"
            />
          </div>
        </div>

        <NButton dashed block size="small" @click="addServer">
          <template #icon><NIcon :component="AddOutline" /></template>
          {{ t('mcp.addServer') }}
        </NButton>

        <div v-if="!drafts.length" class="py-6 text-center text-[13px] text-text-faint">
          {{ t('mcp.noServers') }}
        </div>
      </div>
    </div>
  </div>
</template>

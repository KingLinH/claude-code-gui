<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NInput, useMessage } from 'naive-ui'
import { AddOutline, RefreshOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5'
import { RouterLink } from 'vue-router'
import { useProjectSettingsStore } from '@/stores/projectSettings'
import { relTime } from '@/utils/format'
import { t } from '@/i18n'
import type { ProjectSettingsResponse } from '@shared/types'

const props = defineProps<{ encoded: string }>()
const store = useProjectSettingsStore()
const message = useMessage()

const obj = ref<Record<string, unknown>>({})
const modelValue = ref('')
const envRows = ref<Array<{ key: string; value: string }>>([])
const permAllow = ref<string[]>([])
const permDeny = ref<string[]>([])
const permAsk = ref<string[]>([])
const defaultMode = ref('default')
const hooksRaw = ref('')
const dirty = ref(false)

const modeOptions = [
  { label: 'default', value: 'default' },
  { label: 'acceptEdits', value: 'acceptEdits' },
  { label: 'plan', value: 'plan' },
  { label: 'bypassPermissions', value: 'bypassPermissions' },
]

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function toStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter((x) => x !== '') : []
}

function loadFrom(d: ProjectSettingsResponse) {
  obj.value = deepClone(d.settings)
  const perms = (obj.value.permissions as Record<string, unknown> | undefined) ?? {}
  permAllow.value = toStringList(perms.allow)
  permDeny.value = toStringList(perms.deny)
  permAsk.value = toStringList(perms.ask)
  defaultMode.value = typeof perms.defaultMode === 'string' ? perms.defaultMode : 'default'
  hooksRaw.value = obj.value.hooks != null ? JSON.stringify(obj.value.hooks, null, 2) : ''
  const env = (obj.value.env as Record<string, unknown> | undefined) ?? {}
  envRows.value = Object.entries(env).map(([k, v]) => ({ key: k, value: String(v ?? '') }))
  modelValue.value = typeof obj.value.model === 'string' ? obj.value.model : ''
  dirty.value = false
}

const hooksValid = computed(() => {
  const raw = hooksRaw.value.trim()
  if (!raw) return true
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
})

function touch() {
  dirty.value = true
}

async function save() {
  if (!hooksValid.value) {
    message.error(t('projectSettings.hooksInvalid'))
    return
  }
  const out: Record<string, unknown> = { ...obj.value }

  // model
  if (modelValue.value.trim()) out.model = modelValue.value.trim()
  else delete out.model

  // env (preserve only non-empty keys)
  const env: Record<string, string> = {}
  let dupKey = false
  for (const r of envRows.value) {
    const k = r.key.trim()
    if (!k) continue
    if (k in env) dupKey = true
    env[k] = r.value
  }
  if (Object.keys(env).length) out.env = env
  else delete out.env
  if (dupKey) message.warning(t('settings.envWarning'))

  // permissions (drop empty rules)
  const clean = (list: string[]) => list.map((r) => r.trim()).filter((r) => r !== '')
  const perms: Record<string, unknown> = {}
  const allow = clean(permAllow.value)
  const deny = clean(permDeny.value)
  const ask = clean(permAsk.value)
  if (allow.length) perms.allow = allow
  if (deny.length) perms.deny = deny
  if (ask.length) perms.ask = ask
  if (defaultMode.value && defaultMode.value !== 'default') perms.defaultMode = defaultMode.value
  if (Object.keys(perms).length) out.permissions = perms
  else delete out.permissions

  // hooks
  const raw = hooksRaw.value.trim()
  if (raw) out.hooks = JSON.parse(raw)
  else delete out.hooks

  try {
    await store.save(props.encoded, out)
    message.success(t('projectSettings.saved') + (store.lastBackup ? ` · ${t('common.backupWritten')}` : ''))
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function reset() {
  await store.fetch(props.encoded)
  if (store.data) loadFrom(store.data)
}

onMounted(reset)
watch(
  () => store.data,
  (d) => {
    if (d && !dirty.value) loadFrom(d)
  },
)
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <RouterLink :to="`/projects/${encoded}`" class="text-[12px] text-text-faint transition-colors hover:text-text">← {{ t('projectSettings.title') }}</RouterLink>

      <div class="mt-1 flex items-center gap-3">
        <h1 class="text-[18px] font-semibold break-all">{{ t('projectSettings.title') }}</h1>
        <div class="ml-auto flex items-center gap-1">
          <NButton size="small" quaternary :disabled="store.saving" @click="reset">
            <template #icon><NIcon :component="RefreshOutline" /></template>
            {{ t('common.reset') }}
          </NButton>
          <NButton size="small" type="primary" :disabled="!dirty || store.saving" :loading="store.saving" @click="save">
            <template #icon><NIcon :component="SaveOutline" /></template>
            {{ t('common.save') }}
          </NButton>
        </div>
      </div>
      <p class="mt-1 text-[12px] text-text-faint">{{ t('projectSettings.note') }}</p>
      <p v-if="store.data?.cwd" class="mt-0.5 break-all font-mono text-[11px] text-text-dim">{{ store.data.cwd }}/.claude/settings.json</p>
      <p v-if="store.data && !store.data.exists" class="mt-1 text-[12px] text-warning">⚠ {{ t('projectSettings.notExists') }}</p>
      <p v-else-if="store.data?.mtimeMs" class="mt-1 text-[11px] text-text-faint">
        {{ t('projectSettings.lastModified', { when: relTime(store.data.mtimeMs) }) }}
      </p>

      <div v-if="store.loading && !store.data" class="py-10 text-text-faint">{{ t('common.loading') }}</div>
      <div v-else-if="store.error" class="py-6 text-danger">{{ store.error }}</div>

      <div v-else class="mt-5 space-y-5">
        <!-- model -->
        <div>
          <label class="text-[12px] text-text-dim">{{ t('settings.model') }}</label>
          <NInput v-model:value="modelValue" size="small" class="font-mono max-w-md" @update:value="touch" />
        </div>

        <!-- permissions -->
        <div class="rounded-lg border border-border bg-surface px-3 py-3">
          <div class="mb-2 text-[13px] font-semibold">{{ t('projectSettings.permissions') }}</div>

          <div class="mb-2 flex items-center gap-2">
            <label class="w-28 shrink-0 text-[12px] text-text-dim">{{ t('projectSettings.defaultMode') }}</label>
            <select
              v-model="defaultMode"
              class="max-w-xs rounded-md border border-border bg-surface-2 px-2 py-1 text-[12px] text-text outline-none"
              @change="touch"
            >
              <option v-for="o in modeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <!-- allow / deny / ask lists -->
          <div v-for="spec in [
            { list: permAllow, key: 'projectSettings.permAllow' },
            { list: permDeny, key: 'projectSettings.permDeny' },
            { list: permAsk, key: 'projectSettings.permAsk' },
          ]" :key="spec.key" class="mb-2">
            <div class="mb-1 flex items-center gap-2">
              <label class="text-[12px] text-text-dim">{{ t(spec.key) }}</label>
              <NButton size="tiny" quaternary class="ml-auto" @click="spec.list.push(''); touch()">
                <template #icon><NIcon :component="AddOutline" :size="13" /></template>
                {{ t('common.add') }}
              </NButton>
            </div>
            <div class="space-y-1.5">
              <div v-for="(_, i) in spec.list" :key="i" class="flex items-center gap-1.5">
                <NInput
                  :value="spec.list[i]"
                  size="small"
                  :placeholder="t('projectSettings.permPlaceholder')"
                  class="font-mono"
                  @update:value="(v: string) => { spec.list[i] = v; touch() }"
                />
                <button class="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-danger" @click="spec.list.splice(i, 1); touch()">
                  <NIcon :component="TrashOutline" :size="14" />
                </button>
              </div>
              <div v-if="!spec.list.length" class="text-[12px] text-text-faint">—</div>
            </div>
          </div>
        </div>

        <!-- hooks (raw JSON) -->
        <div>
          <div class="mb-1 flex items-center gap-2">
            <label class="text-[12px] text-text-dim">{{ t('projectSettings.hooks') }}</label>
            <span class="text-[11px] text-text-faint">{{ t('projectSettings.hooksNote') }}</span>
            <span v-if="!hooksValid" class="text-[11px] text-danger">⚠ invalid JSON</span>
          </div>
          <NInput v-model:value="hooksRaw" type="textarea" :rows="6" class="font-mono" @update:value="touch" />
        </div>

        <!-- env -->
        <div>
          <div class="mb-1 flex items-center gap-2">
            <label class="text-[12px] text-text-dim">{{ t('projectSettings.env') }}</label>
            <span class="text-[11px] text-warning">⚠ {{ t('settings.envWarning') }}</span>
            <NButton size="tiny" quaternary class="ml-auto" @click="envRows.push({ key: '', value: '' }); touch()">
              <template #icon><NIcon :component="AddOutline" :size="13" /></template>
              {{ t('common.add') }}
            </NButton>
          </div>
          <div class="space-y-1.5">
            <div v-for="(r, i) in envRows" :key="i" class="flex items-center gap-1.5">
              <NInput v-model:value="r.key" size="small" :placeholder="t('settings.keyPlaceholder')" class="font-mono" @update:value="touch" />
              <span class="text-text-faint">=</span>
              <NInput v-model:value="r.value" size="small" :placeholder="t('settings.valuePlaceholder')" class="font-mono" type="password" :show-password-on="`click`" @update:value="touch" />
              <button class="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-danger" @click="envRows.splice(i, 1); touch()">
                <NIcon :component="TrashOutline" :size="14" />
              </button>
            </div>
            <div v-if="!envRows.length" class="text-[12px] text-text-faint">{{ t('settings.noEnv') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

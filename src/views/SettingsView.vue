<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import { AddOutline, RefreshOutline, SaveOutline, TrashOutline } from '@vicons/ionicons5'
import { useSettingsStore } from '@/stores/settings'
import { relTime } from '@/utils/format'
import { t } from '@/i18n'

const store = useSettingsStore()
const message = useMessage()

const obj = ref<Record<string, unknown>>({})
const envRows = ref<Array<{ key: string; value: string }>>([])
const dirty = ref(false)

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function loadFrom(d: { settings: Record<string, unknown> }) {
  obj.value = deepClone(d.settings)
  const env = (obj.value.env as Record<string, unknown> | undefined) ?? {}
  envRows.value = Object.entries(env).map(([k, v]) => ({ key: k, value: String(v ?? '') }))
  dirty.value = false
}

const model = computed<string>({
  get: () => String(obj.value.model ?? ''),
  set: (v) => {
    obj.value.model = v
    touch()
  },
})

const includeCoauthored = computed<boolean>({
  get: () => obj.value.includeCoAuthoredBy === true,
  set: (v) => {
    obj.value.includeCoAuthoredBy = v
    touch()
  },
})

const rawJson = computed(() => {
  // mirror of the working object (env rows folded in) — read-only transparency
  const env: Record<string, string> = {}
  for (const r of envRows.value) if (r.key.trim()) env[r.key.trim()] = r.value
  const mirror = { ...obj.value, env }
  try {
    return JSON.stringify(mirror, null, 2)
  } catch {
    return String(mirror)
  }
})

function touch() {
  dirty.value = true
}

function addEnv() {
  envRows.value.push({ key: '', value: '' })
  touch()
}

function removeEnv(i: number) {
  envRows.value.splice(i, 1)
  touch()
}

async function save() {
  const env: Record<string, string> = {}
  let dupKey = false
  for (const r of envRows.value) {
    const k = r.key.trim()
    if (!k) continue
    if (k in env) dupKey = true
    env[k] = r.value
  }
  if (dupKey) message.warning('Duplicate env keys — later values overwrote earlier.')
  const out = { ...obj.value, env }
  try {
    await store.save(out)
    message.success(t('settings.saved') + (store.lastBackup ? ` · ${t('common.backupWritten')}` : ''))
    if (store.data) loadFrom(store.data)
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function reset() {
  await store.fetch()
  if (store.data) loadFrom(store.data)
}

onMounted(reset)
watch(() => store.data, (d) => {
  if (d && !dirty.value) loadFrom(d)
})
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="content-col px-6 py-6">
      <div class="flex items-center gap-3">
        <h1 class="text-[18px] font-semibold">{{ t('settings.title') }}</h1>
        <div class="ml-auto flex items-center gap-1">
          <NButton size="small" quaternary :disabled="store.saving" @click="reset">
            <template #icon><NIcon :component="RefreshOutline" /></template>
            {{ t('common.reset') }}
          </NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="!dirty || store.saving"
            :loading="store.saving"
            @click="save"
          >
            <template #icon><NIcon :component="SaveOutline" /></template>
            Save
          </NButton>
        </div>
      </div>
      <p class="mt-1 text-[12px] text-text-faint">
        {{ t('settings.note') }}
        <span v-if="store.data?.mtimeMs">{{ t('settings.lastModified', { when: relTime(store.data.mtimeMs) }) }}</span>
      </p>

      <div v-if="store.loading && !Object.keys(obj).length" class="py-10 text-text-faint">{{ t('common.loading') }}</div>
      <div v-else-if="store.error" class="py-6 text-danger">{{ store.error }}</div>

      <div v-else class="mt-5 space-y-5">
        <!-- model -->
        <div>
          <label class="text-[12px] text-text-dim">{{ t('settings.model') }}</label>
          <NInput v-model:value="model" size="small" class="font-mono max-w-md" @update:value="touch" />
        </div>

        <!-- includeCoAuthoredBy -->
        <div class="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
          <div>
            <div class="text-[13px]">includeCoAuthoredBy</div>
            <div class="text-[11px] text-text-faint">{{ t('settings.coAuthored') }}</div>
          </div>
          <NSwitch v-model:value="includeCoauthored" />
        </div>

        <!-- env -->
        <div>
          <div class="mb-1 flex items-center gap-2">
            <label class="text-[12px] text-text-dim">{{ t('settings.env') }}</label>
            <span class="text-[11px] text-warning">⚠ may contain secrets (API keys, tokens)</span>
            <NButton size="tiny" quaternary class="ml-auto" @click="addEnv">
              <template #icon><NIcon :component="AddOutline" :size="13" /></template>
              {{ t('common.add') }}
            </NButton>
          </div>
          <div class="space-y-1.5">
            <div v-for="(r, i) in envRows" :key="i" class="flex items-center gap-1.5">
              <NInput
                v-model:value="r.key"
                size="small"
                :placeholder="t('settings.keyPlaceholder')"
                class="font-mono"
                @update:value="touch"
              />
              <span class="text-text-faint">=</span>
              <NInput
                v-model:value="r.value"
                size="small"
                :placeholder="t('settings.valuePlaceholder')"
                class="font-mono"
                type="password"
                :show-password-on="`click`"
                @update:value="touch"
              />
              <button
                class="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-danger"
                @click="removeEnv(i)"
              >
                <NIcon :component="TrashOutline" :size="14" />
              </button>
            </div>
            <div v-if="!envRows.length" class="text-[12px] text-text-faint">{{ t('settings.noEnv') }}</div>
          </div>
        </div>

        <!-- raw JSON mirror -->
        <div>
          <div class="mb-1 text-[11px] uppercase tracking-wide text-text-faint">
            {{ t('settings.mirror') }}
          </div>
          <pre class="overflow-auto rounded-lg border border-border bg-[#0a0a0c] p-3 font-mono text-[12px] leading-relaxed text-text-dim">{{ rawJson }}</pre>
        </div>

        <!-- config.json -->
        <div class="rounded-lg border border-border bg-surface px-3 py-2">
          <div class="text-[12px] text-text-dim">
            {{ t('settings.configFile') }}
            <span v-if="store.data?.configHasApiKey" class="ml-1 font-mono text-text">
              {{ store.data.apiKeyMasked }}
            </span>
            <span v-else class="text-text-faint">{{ t('settings.apiKeyNotSet') }}</span>
          </div>
          <div class="mt-0.5 text-[11px] text-text-faint">{{ t('settings.configNote') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

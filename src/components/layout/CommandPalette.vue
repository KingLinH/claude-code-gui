<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NInput, NModal } from 'naive-ui'
import { locale, setLocale, t } from '@/i18n'
import { toggleTheme } from '@/composables/useTheme'
import { NAV_ROUTES, type Command } from '@/composables/commands'
import { useShortcuts } from '@/composables/useShortcut'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const router = useRouter()
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<InstanceType<typeof NInput> | null>(null)

const commands = computed<Command[]>(() => {
  const nav: Command[] = NAV_ROUTES.map((r) => ({
    id: 'nav-' + r.label,
    title: t('nav.' + r.label),
    section: 'navigate',
    icon: r.icon,
    run: () => router.push(r.to),
  }))
  return [
    ...nav,
    { id: 'act-search', title: t('palette.search'), section: 'actions', run: () => router.push('/search') },
    { id: 'act-theme', title: t('palette.toggleTheme'), section: 'actions', run: () => toggleTheme() },
    {
      id: 'act-lang',
      title: t('palette.toggleLang'),
      section: 'actions',
      run: () => setLocale(locale.value === 'zh' ? 'en' : 'zh'),
    },
  ]
})

const filtered = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  return commands.value.filter((c) => c.title.toLowerCase().includes(q))
})

const rows = computed(() =>
  filtered.value.map((cmd, i) => ({
    cmd,
    firstInSection: i === 0 || filtered.value[i - 1].section !== cmd.section,
  })),
)

watch(filtered, () => {
  if (activeIndex.value >= filtered.value.length) {
    activeIndex.value = Math.max(0, filtered.value.length - 1)
  }
})

watch(
  () => props.show,
  async (v) => {
    if (v) {
      query.value = ''
      activeIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

function close(): void {
  emit('update:show', false)
}

function move(delta: number): void {
  const n = filtered.value.length
  if (!n) return
  activeIndex.value = (activeIndex.value + delta + n) % n
}

function run(cmd?: Command): void {
  const c = cmd ?? filtered.value[activeIndex.value]
  if (!c) return
  c.run()
  close()
}

// Palette-internal keys (gated on `show`). Open (Ctrl/Cmd+K) is owned by AppShell.
useShortcuts([
  { key: 'escape', allowInField: true, handler: () => { if (props.show) close() } },
  { key: 'enter', allowInField: true, handler: () => { if (props.show) run() } },
  { key: 'arrowdown', allowInField: true, handler: () => { if (props.show) move(1) } },
  { key: 'arrowup', allowInField: true, handler: () => { if (props.show) move(-1) } },
])
</script>

<template>
  <NModal
    :show="show"
    :auto-focus="false"
    :close-on-esc="false"
    :mask-closable="true"
    transform-origin="center"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="command-palette">
      <NInput
        ref="inputRef"
        v-model:value="query"
        :placeholder="t('palette.placeholder')"
        :bordered="false"
        size="large"
      />
      <div v-if="rows.length" class="palette-list">
        <template v-for="row in rows" :key="row.cmd.id">
          <div v-if="row.firstInSection" class="palette-section">
            {{ row.cmd.section === 'navigate' ? t('palette.section.navigate') : t('palette.section.actions') }}
          </div>
          <button
            class="palette-item"
            :class="{ active: rows[activeIndex] && rows[activeIndex].cmd.id === row.cmd.id }"
            @mouseenter="activeIndex = rows.findIndex((r) => r.cmd.id === row.cmd.id)"
            @click="run(row.cmd)"
          >
            <NIcon v-if="row.cmd.icon" :component="row.cmd.icon" :size="15" class="text-text-faint" />
            <span class="palette-item-title">{{ row.cmd.title }}</span>
          </button>
        </template>
      </div>
      <div v-else class="palette-empty">{{ t('palette.empty') }}</div>
    </div>
  </NModal>
</template>

<style scoped>
.command-palette {
  width: min(560px, 92vw);
  max-height: min(60vh, 520px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  margin-top: 12vh;
}
.palette-list {
  overflow-y: auto;
  padding: 6px;
  border-top: 1px solid var(--border);
}
.palette-section {
  padding: 8px 10px 3px;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-faint);
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13.5px;
  color: var(--text-dim);
  text-align: left;
  transition: background-color 0.08s;
}
.palette-item.active {
  background: var(--surface-2);
  color: var(--text);
}
.palette-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.palette-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-faint);
  border-top: 1px solid var(--border);
}
</style>

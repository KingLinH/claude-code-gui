<script setup lang="ts">
import { type Component } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BookOutline,
  ChatbubblesOutline,
  CubeOutline,
  DocumentTextOutline,
  ExtensionPuzzleOutline,
  FolderOpenOutline,
  GridOutline,
  MoonOutline,
  SearchOutline,
  SettingsOutline,
  SunnyOutline,
  TerminalOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { availableLocales, locale, setLocale, t } from '@/i18n'
import { theme, toggleTheme } from '@/composables/useTheme'

interface NavItem {
  to: string
  labelKey: string
  icon: Component
  exact?: boolean
}

const nav: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: GridOutline, exact: true },
  { to: '/search', labelKey: 'nav.search', icon: SearchOutline },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpenOutline },
  { to: '/sessions', labelKey: 'nav.sessions', icon: ChatbubblesOutline },
  { to: '/mcp', labelKey: 'nav.mcp', icon: CubeOutline },
  { to: '/skills', labelKey: 'nav.skills', icon: ExtensionPuzzleOutline },
  { to: '/memory', labelKey: 'nav.memory', icon: BookOutline },
  { to: '/plans', labelKey: 'nav.plans', icon: DocumentTextOutline },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsOutline },
]
</script>

<template>
  <aside class="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
    <div class="flex items-center gap-2 px-4 py-4">
      <span class="text-accent">
        <NIcon :component="TerminalOutline" :size="20" />
      </span>
      <div class="leading-tight">
        <div class="text-[13px] font-semibold tracking-wide text-text">{{ t('app.name') }}</div>
        <div class="text-[11px] text-text-faint">{{ t('app.sub') }}</div>
      </div>
    </div>

    <nav class="mt-1 flex flex-col gap-0.5 px-2">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :class="[
          'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
          'text-text-dim hover:bg-surface-2 hover:text-text',
        ]"
        :active-class="item.exact ? '' : '!bg-surface-2 !text-accent'"
        :exact-active-class="item.exact ? '!bg-surface-2 !text-accent' : ''"
      >
        <NIcon :component="item.icon" :size="16" />
        <span>{{ t(item.labelKey) }}</span>
      </RouterLink>
    </nav>

    <div class="mt-auto space-y-2 px-3 py-3">
      <!-- theme toggle -->
      <button
        class="flex w-full items-center justify-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-[11px] text-text-dim transition-colors hover:text-text"
        :title="theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
        @click="toggleTheme"
      >
        <NIcon :component="theme === 'dark' ? SunnyOutline : MoonOutline" :size="14" />
        <span>{{ theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark') }}</span>
      </button>
      <!-- language toggle -->
      <div class="flex items-center gap-1 rounded-md bg-surface-2 p-0.5">
        <button
          v-for="l in availableLocales"
          :key="l.value"
          class="flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors"
          :class="locale === l.value ? 'bg-surface text-text shadow-sm' : 'text-text-faint hover:text-text'"
          @click="setLocale(l.value)"
        >
          {{ l.label }}
        </button>
      </div>
      <div class="px-1 text-[11px] text-text-faint">
        <div>{{ t('sidebar.readOnly') }}</div>
        <div class="truncate font-mono">~/.claude</div>
      </div>
    </div>
  </aside>
</template>

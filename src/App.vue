<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NDialogProvider, NLoadingBarProvider, NMessageProvider } from 'naive-ui'
import { darkTheme, getThemeOverrides } from './theme'
import { theme } from '@/composables/useTheme'
import AppShell from '@/components/layout/AppShell.vue'

// null theme = Naive UI's light theme.
const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : null))
const overrides = computed(() => getThemeOverrides(theme.value))
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="overrides">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <AppShell />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>

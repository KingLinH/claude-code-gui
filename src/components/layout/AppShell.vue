<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import CommandPalette from './CommandPalette.vue'
import { useShortcuts } from '@/composables/useShortcut'
import { toggleTheme } from '@/composables/useTheme'
import { locale, setLocale } from '@/i18n'

const router = useRouter()
const paletteOpen = ref(false)

useShortcuts([
  { key: 'k', mod: true, allowInField: true, handler: () => (paletteOpen.value = true) },
  { key: 'j', mod: true, allowInField: true, handler: () => toggleTheme() },
  { key: 'l', mod: true, shift: true, allowInField: true, handler: () => setLocale(locale.value === 'zh' ? 'en' : 'zh') },
  { key: '/', handler: () => router.push('/search') },
])
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-bg text-text">
    <Sidebar />
    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <router-view :key="$route.fullPath" />
    </main>
    <CommandPalette v-model:show="paletteOpen" />
  </div>
</template>

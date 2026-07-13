<script setup lang="ts">
import Sidebar from './Sidebar.vue'
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-bg text-text">
    <Sidebar />
    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <router-view :key="$route.fullPath" />
    </main>
  </div>
</template>

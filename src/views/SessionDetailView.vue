<script setup lang="ts">
import TranscriptView from '@/components/transcript/TranscriptView.vue'

defineProps<{ encoded: string; id: string }>()
</script>

<template>
  <TranscriptView :encoded="encoded" :id="id" />
</template>

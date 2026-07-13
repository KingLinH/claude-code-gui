<script setup lang="ts">
import type { Turn } from '@shared/types'
import UserTurn from './UserTurn.vue'
import AssistantTurn from './AssistantTurn.vue'
import { t as $t } from '@/i18n'

defineProps<{ turns: Turn[]; encoded?: string; sessionId?: string }>()
</script>

<template>
  <div class="space-y-5">
    <template v-for="t in turns" :key="t.uuid">
      <UserTurn v-if="t.kind === 'user'" :turn="t" />
      <AssistantTurn
        v-else-if="t.kind === 'assistant'"
        :turn="t"
        :encoded="encoded"
        :session-id="sessionId"
      />
      <div
        v-else
        class="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 font-mono text-[12px] text-text-dim"
      >
        {{ $t('transcript.orphanResult', { id: t.toolUseId }) }}
      </div>
    </template>
  </div>
</template>

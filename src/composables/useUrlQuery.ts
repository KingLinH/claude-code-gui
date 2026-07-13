import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Bind a string value to a URL query param. The returned `value` is a WRITABLE
 * computed: reading it reflects `route.query[key]`; assigning it (or v-model)
 * calls `router.replace` so the value survives refresh without spamming history.
 * `set` is the same setter, for explicit calls.
 */
export function useUrlQuery(key: string) {
  const route = useRoute()
  const router = useRouter()

  function apply(v: string) {
    const cur = typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
    if (v === cur) return
    void router.replace({ query: { ...route.query, [key]: v || undefined } })
  }

  const value = computed<string>({
    get: () => {
      const v = route.query[key]
      return typeof v === 'string' ? v : ''
    },
    set: apply,
  })

  return { value, set: apply }
}

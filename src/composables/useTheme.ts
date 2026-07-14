import { ref } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ccg-theme'

function detect(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* localStorage unavailable */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

function apply(t: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t)
  }
}

/**
 * Global reactive theme. The token palette is driven by `data-theme` on <html>
 * (see src/styles/theme-tokens.css); Naive UI is driven reactively via App.vue.
 * Reading `theme` inside a computed/render makes consumers reactive.
 */
export const theme = ref<Theme>(detect())
apply(theme.value)

export function setTheme(t: Theme): void {
  theme.value = t
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore */
  }
  apply(t)
}

export function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

// Follow OS preference changes, but only until the user makes an explicit choice.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const sync = (e: MediaQueryListEvent): void => {
    let chosen = false
    try {
      chosen = !!localStorage.getItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (!chosen) setTheme(e.matches ? 'dark' : 'light')
  }
  // addEventListener is the modern API (addListener is deprecated).
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', sync)
  else mq.addListener(sync)
}

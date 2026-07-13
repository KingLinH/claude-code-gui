import { ref } from 'vue'
import { zh } from './zh'
import { en } from './en'

export type Locale = 'zh' | 'en'
type Dict = Record<string, string>

const messages: Record<Locale, Dict> = { zh, en }
const STORAGE_KEY = 'ccg-locale'

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* localStorage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return nav.toLowerCase().startsWith('en') ? 'en' : 'zh'
}

/** Global reactive locale. Reading it inside render/computed makes `t()` reactive. */
export const locale = ref<Locale>(detect())

export const availableLocales: Array<{ value: Locale; label: string }> = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
]

export function setLocale(l: Locale) {
  locale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', l === 'zh' ? 'zh-CN' : 'en')
  }
}

/** Translate a key, interpolating {name} placeholders. Falls back to zh, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[locale.value] ?? zh
  let s = dict[key] ?? zh[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

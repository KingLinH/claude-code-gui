import { locale, t } from '@/i18n'

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function fmtTokens(n?: number): string {
  if (!n || n < 1 || !Number.isFinite(n)) return '—'
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

export function fmtCost(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n === 0) return '$0.00'
  if (n < 0.01) return `<$0.01`
  return `$${n.toFixed(2)}`
}

export function fmtDuration(ms?: number): string {
  if (!ms || ms < 1) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm}m` : `${h}h`
}

/** Locale-aware absolute time. Reads the app locale so it re-renders on switch. */
export function fmtTime(ts?: string | number): string {
  if (ts == null) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return String(ts)
  const l = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleString(l, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Locale-aware relative time. */
export function relTime(ts?: string | number): string {
  if (ts == null) return '—'
  const t0 = typeof ts === 'number' ? ts : new Date(ts).getTime()
  if (!t0 || isNaN(t0)) return '—'
  const diff = Date.now() - t0
  const s = Math.round(diff / 1000)
  if (s < 0) return fmtTime(ts)
  if (s < 60) return t('reltime.justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return t('reltime.minutesAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('reltime.hoursAgo', { n: h })
  const d = Math.floor(h / 24)
  if (d < 30) return t('reltime.daysAgo', { n: d })
  return fmtTime(ts)
}

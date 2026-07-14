import { onBeforeUnmount, onMounted } from 'vue'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Ctrl (Windows/Linux) or Cmd (macOS). */
function isMod(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey
}

export interface ShortcutBinding {
  /** Lowercase key name, e.g. 'k', '/', 'escape', 'arrowdown'. */
  key: string
  /** Require ctrl/cmd. */
  mod?: boolean
  /** Require shift. */
  shift?: boolean
  /** Fire even while focused in an input/textarea (default false). */
  allowInField?: boolean
  handler: (e: KeyboardEvent) => void
}

function matches(b: ShortcutBinding, e: KeyboardEvent): boolean {
  if (e.key.toLowerCase() !== b.key.toLowerCase()) return false
  if (!!b.mod !== isMod(e)) return false
  if (!!b.shift !== e.shiftKey) return false
  if (!b.allowInField && isTypingTarget(e.target)) return false
  return true
}

/**
 * Attach a set of global keydown bindings for the component's lifetime.
 * Each match calls preventDefault and runs the first matching handler.
 */
export function useShortcuts(bindings: ShortcutBinding[]): void {
  const onKey = (e: KeyboardEvent) => {
    for (const b of bindings) {
      if (matches(b, e)) {
        e.preventDefault()
        b.handler(e)
        return
      }
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}

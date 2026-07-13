import type { Directive } from 'vue'

/**
 * Bind to an NInput (or any element wrapping an <input>/<textarea>): on mount, find
 * the inner control and select-all whenever it receives focus. If it is already
 * focused at mount time (e.g. autofocus inside a freshly-opened modal), select now.
 */
export const vSelectAllOnFocus: Directive<HTMLElement> = {
  mounted(el) {
    const input = el.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
    if (!input) return
    input.addEventListener('focus', () => input.select())
    if (document.activeElement === input) input.select()
  },
}

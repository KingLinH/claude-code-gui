import MarkdownIt from 'markdown-it'
// Import the core only (no bundled languages) and register a curated subset,
// instead of `highlight.js` (which bundles ~190 languages and ~1MB). Aliases
// (js, jsx, ts, tsx, py, sh, yml, …) ship inside each language definition.
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, def] of [
  ['javascript', javascript],
  ['typescript', typescript],
  ['python', python],
  ['bash', bash],
  ['shell', shell],
  ['json', json],
  ['yaml', yaml],
  ['xml', xml],
  ['html', xml],
  ['css', css],
  ['sql', sql],
  ['go', go],
  ['rust', rust],
  ['java', java],
  ['c', c],
  ['cpp', cpp],
  ['csharp', csharp],
  ['ruby', ruby],
  ['php', php],
  ['markdown', markdown],
  ['dockerfile', dockerfile],
  ['ini', ini],
  ['diff', diff],
  ['plaintext', plaintext],
] as const) {
  hljs.registerLanguage(name, def)
}

function highlight(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`
    } catch {
      /* fall through */
    }
  }
  try {
    return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`
  } catch {
    return ''
  }
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight,
})

// open external links in a new tab
const defaultLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = ((
  tokens: { attrSet: (k: string, v: string) => void }[] & unknown,
  idx: number,
  options: unknown,
  env: unknown,
  self: { renderToken: (t: unknown, i: number, o: unknown) => string } & unknown,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (tokens as any[])[idx]
  t.attrSet('target', '_blank')
  t.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (defaultLinkOpen as any)(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}) as typeof defaultLinkOpen

export function renderMarkdown(s: string): string {
  return md.render(s ?? '')
}

export function renderMarkdownInline(s: string): string {
  return md.renderInline(s ?? '')
}

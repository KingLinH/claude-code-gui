import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

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

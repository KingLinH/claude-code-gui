import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { Router } from 'express'
import { HttpError, PLANS_DIR, PROJECTS_DIR } from '../paths.js'
import { asyncHandler, clamp } from '../lib.js'
import { resolveSkillDir, walkSkills } from '../skills-walker.js'
import { readFirstCwd } from '../jsonl.js'
import type { SearchHit } from '../../shared/types.js'

export const searchRouter = Router()

const PER_FILE_CAP = 5
const MAX_QUERY = 200

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Flatten a transcript line into searchable (label, text) candidates. */
function candidates(obj: any): Array<{ label: string; text: string }> {
  const msg = obj?.message
  const out: Array<{ label: string; text: string }> = []
  if (obj?.type === 'user') {
    if (typeof msg?.content === 'string') out.push({ label: 'user', text: msg.content })
    else if (Array.isArray(msg?.content)) {
      for (const b of msg.content) {
        if (!b || typeof b !== 'object') continue
        if (b.type === 'text' && typeof b.text === 'string') out.push({ label: 'user', text: b.text })
        else if (b.type === 'tool_result') out.push({ label: 'result', text: stringifyResult(b.content) })
      }
    }
  } else if (obj?.type === 'assistant' && Array.isArray(msg?.content)) {
    for (const b of msg.content) {
      if (!b || typeof b !== 'object') continue
      if (b.type === 'text' && typeof b.text === 'string') out.push({ label: 'assistant', text: b.text })
      else if (b.type === 'tool_use') out.push({ label: `tool: ${b.name}`, text: JSON.stringify(b.input ?? {}) })
    }
  }
  return out
}

function stringifyResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as any).text) : JSON.stringify(c))).join('\n')
  return JSON.stringify(content)
}

function snippetAround(text: string, lower: string): string {
  const i = text.toLowerCase().indexOf(lower)
  if (i < 0) return text.slice(0, 150)
  const start = Math.max(0, i - 60)
  const end = Math.min(text.length, i + lower.length + 90)
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '')
}

function extractMatch(obj: any, lower: string): { label: string; snippet: string } | null {
  for (const c of candidates(obj)) {
    if (c.text.toLowerCase().includes(lower)) {
      return { label: c.label, snippet: snippetAround(c.text, lower) }
    }
  }
  return null
}

/** Stream one transcript file, returning up to `cap` session hits. */
async function searchTranscript(
  file: string,
  encoded: string,
  lower: string,
  cap: number,
): Promise<SearchHit[]> {
  const out: SearchHit[] = []
  const sessionId = path.basename(file, '.jsonl')
  let aiTitle: string | undefined
  // cwd resolved once from the first transcript line (cheap)
  const cwd = (await readFirstCwd(file)) ?? undefined
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  try {
    for await (const line of rl) {
      // cheaply harvest the session title from ai-title lines (few per file)
      if (line.includes('"ai-title"')) {
        try {
          const o = JSON.parse(line)
          if (o?.type === 'ai-title' && o.aiTitle) aiTitle = o.aiTitle
        } catch {
          /* ignore */
        }
      }
      if (!line.toLowerCase().includes(lower)) continue
      let obj: any
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }
      const m = extractMatch(obj, lower)
      if (!m) continue
      out.push({
        type: 'session',
        encoded,
        cwd,
        sessionId,
        aiTitle,
        title: aiTitle || sessionId.slice(0, 8),
        label: m.label,
        snippet: m.snippet,
        ts: obj.timestamp,
      })
      if (out.length >= cap) break
    }
  } finally {
    rl.close()
  }
  return out
}

function mdSnippet(text: string, lower: string): string {
  return snippetAround(text, lower)
}

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q) {
      res.json([])
      return
    }
    if (q.length > MAX_QUERY) throw new HttpError(400, 'query too long')
    const limit = clamp(Number.parseInt((req.query.limit as string) ?? '', 10) || 50, 1, 200)
    const lower = q.toLowerCase()
    const hits: SearchHit[] = []

    // --- transcripts ---
    if (fs.existsSync(PROJECTS_DIR)) {
      const projects = fs.readdirSync(PROJECTS_DIR).filter((n) => {
        try {
          return fs.statSync(path.join(PROJECTS_DIR, n)).isDirectory()
        } catch {
          return false
        }
      })
      for (const enc of projects) {
        if (hits.length >= limit) break
        const dir = path.join(PROJECTS_DIR, enc)
        let files: Array<{ f: string; p: string; mtime: number }> = []
        try {
          files = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.jsonl'))
            .map((f) => {
              const p = path.join(dir, f)
              return { f, p, mtime: fs.statSync(p).mtimeMs }
            })
            .sort((a, b) => b.mtime - a.mtime)
        } catch {
          continue
        }
        for (const { p } of files) {
          if (hits.length >= limit) break
          const found = await searchTranscript(p, enc, lower, PER_FILE_CAP)
          for (const h of found) {
            hits.push(h)
            if (hits.length >= limit) break
          }
        }
      }
    }

    // --- memory ---
    if (hits.length < limit && fs.existsSync(PROJECTS_DIR)) {
      for (const enc of fs.readdirSync(PROJECTS_DIR)) {
        if (hits.length >= limit) break
        const memDir = path.join(PROJECTS_DIR, enc, 'memory')
        if (!fs.existsSync(memDir)) continue
        for (const f of fs.readdirSync(memDir)) {
          if (hits.length >= limit) break
          if (!f.endsWith('.md') || f === 'MEMORY.md') continue
          const p = path.join(memDir, f)
          let text: string
          try {
            text = fs.readFileSync(p, 'utf8')
          } catch {
            continue
          }
          const i = text.toLowerCase().indexOf(lower)
          if (i < 0) continue
          hits.push({
            type: 'memory',
            encoded: enc,
            slug: f.slice(0, -3),
            title: f.slice(0, -3),
            snippet: mdSnippet(text, lower),
          })
        }
      }
    }

    // --- skills ---
    if (hits.length < limit) {
      try {
        for (const s of walkSkills()) {
          if (hits.length >= limit) break
          const dir = resolveSkillDir(s.id).dir
          const mdPath = path.join(dir, 'SKILL.md')
          let text: string
          try {
            text = fs.readFileSync(mdPath, 'utf8')
          } catch {
            continue
          }
          const i = text.toLowerCase().indexOf(lower)
          if (i < 0) continue
          hits.push({
            type: 'skill',
            skillId: s.id,
            title: s.name,
            snippet: mdSnippet(text, lower),
          })
        }
      } catch {
        /* ignore walker errors */
      }
    }

    // --- plans ---
    if (hits.length < limit && fs.existsSync(PLANS_DIR)) {
      for (const f of fs.readdirSync(PLANS_DIR)) {
        if (hits.length >= limit) break
        if (!f.endsWith('.md')) continue
        const p = path.join(PLANS_DIR, f)
        let text: string
        try {
          text = fs.readFileSync(p, 'utf8')
        } catch {
          continue
        }
        const i = text.toLowerCase().indexOf(lower)
        if (i < 0) continue
        const m = text.match(/^#\s+(.+)$/m)
        hits.push({
          type: 'plan',
          planFile: f,
          title: m ? m[1].trim() : f,
          snippet: mdSnippet(text, lower),
        })
      }
    }

    res.json(hits)
  }),
)

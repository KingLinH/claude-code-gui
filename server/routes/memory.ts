import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import matter from 'gray-matter'
import { asyncHandler } from '../lib.js'
import { HttpError, projectDir } from '../paths.js'
import { atomicWrite, backupFile } from '../safe-write.js'
import type { MemoryDetail, MemoryFileInfo, MemoryIndexEntry, MemoryListResponse } from '../../shared/types.js'

export const memoryRouter = Router()
const RE_SLUG = /^[A-Za-z0-9_-]+$/

function memDirOf(encoded: string): string {
  return path.join(projectDir(encoded), 'memory')
}

function parseIndex(text: string): MemoryIndexEntry[] {
  const out: MemoryIndexEntry[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*\[([^\]]*)\]\(([^)]+)\)\s*(?:[—-])?\s*(.*)$/)
    if (m) out.push({ title: m[1].trim(), file: m[2].trim(), summary: m[3].trim() })
  }
  return out
}

/** GET /api/memory/:encoded — list memory files + MEMORY.md index for a project. */
memoryRouter.get(
  '/:encoded',
  asyncHandler(async (req, res) => {
    const dir = memDirOf(req.params.encoded)
    if (!fs.existsSync(dir)) {
      res.json({ index: [], files: [], hasMemory: false } as MemoryListResponse)
      return
    }
    const indexPath = path.join(dir, 'MEMORY.md')
    const index = fs.existsSync(indexPath) ? parseIndex(fs.readFileSync(indexPath, 'utf8')) : []
    const files: MemoryFileInfo[] = []

    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md') || f === 'MEMORY.md') continue
      const p = path.join(dir, f)
      let stat: fs.Stats
      try {
        stat = fs.statSync(p)
      } catch {
        continue
      }
      let fm: Record<string, unknown> = {}
      try {
        fm = (matter(fs.readFileSync(p, 'utf8')).data ?? {}) as Record<string, unknown>
      } catch {
        /* unreadable frontmatter — show anyway */
      }
      const meta = (fm.metadata ?? {}) as Record<string, unknown>
      const idx = index.find((i) => i.file === f)
      files.push({
        slug: f.slice(0, -3),
        name: typeof fm.name === 'string' ? fm.name : undefined,
        description: typeof fm.description === 'string' ? fm.description : undefined,
        type: typeof meta.type === 'string' ? meta.type : undefined,
        originSessionId: typeof meta.originSessionId === 'string' ? meta.originSessionId : undefined,
        title: idx?.title,
        summary: idx?.summary,
        mtimeMs: stat.mtimeMs,
      })
    }

    files.sort((a, b) => b.mtimeMs - a.mtimeMs)
    res.json({ index, files, hasMemory: true } as MemoryListResponse)
  }),
)

/** GET /api/memory/:encoded/:slug — full memory file (raw + frontmatter + body). */
memoryRouter.get(
  '/:encoded/:slug',
  asyncHandler(async (req, res) => {
    if (!RE_SLUG.test(req.params.slug)) throw new HttpError(400, 'Invalid slug')
    const file = path.join(memDirOf(req.params.encoded), `${req.params.slug}.md`)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Memory not found')
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = matter(raw)
    res.json({
      slug: req.params.slug,
      raw,
      frontmatter: parsed.data ?? {},
      body: parsed.content,
      mtimeMs: fs.statSync(file).mtimeMs,
    } as MemoryDetail)
  }),
)

/** PUT /api/memory/:encoded/:slug — replace full file content (backup + atomic). */
memoryRouter.put(
  '/:encoded/:slug',
  asyncHandler(async (req, res) => {
    if (!RE_SLUG.test(req.params.slug)) throw new HttpError(400, 'Invalid slug')
    if (typeof req.body?.content !== 'string') throw new HttpError(422, 'content (string) required')
    const dir = memDirOf(req.params.encoded)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${req.params.slug}.md`)
    const backup = backupFile(file)
    atomicWrite(file, req.body.content)
    res.json({ ok: true, backup: backup?.archive ?? null, mtimeMs: fs.statSync(file).mtimeMs })
  }),
)

/** POST /api/memory/:encoded — create a new memory file. */
memoryRouter.post(
  '/:encoded',
  asyncHandler(async (req, res) => {
    const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : ''
    if (!RE_SLUG.test(slug) || slug === 'MEMORY') throw new HttpError(422, 'valid slug required')
    const content = typeof req.body?.content === 'string' ? req.body.content : ''
    const dir = memDirOf(req.params.encoded)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `${slug}.md`)
    if (fs.existsSync(file)) throw new HttpError(409, 'Memory already exists')
    atomicWrite(file, content)
    res.json({ ok: true, slug })
  }),
)

/** DELETE /api/memory/:encoded/:slug — remove a memory file (backup first). */
memoryRouter.delete(
  '/:encoded/:slug',
  asyncHandler(async (req, res) => {
    if (!RE_SLUG.test(req.params.slug)) throw new HttpError(400, 'Invalid slug')
    const file = path.join(memDirOf(req.params.encoded), `${req.params.slug}.md`)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Memory not found')
    const backup = backupFile(file)
    fs.unlinkSync(file)
    res.json({ ok: true, backup: backup?.archive ?? null })
  }),
)

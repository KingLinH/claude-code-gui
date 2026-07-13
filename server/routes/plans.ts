import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { HttpError, PLANS_DIR, safeJoin } from '../paths.js'
import { asyncHandler } from '../lib.js'
import { atomicWrite, backupFile } from '../safe-write.js'

export const plansRouter = Router()
const RE_PLAN = /^[A-Za-z0-9._()[\]-]+\.md$/

interface PlanInfo {
  file: string
  title: string
  sizeBytes: number
  mtimeMs: number
}

plansRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    if (!fs.existsSync(PLANS_DIR)) {
      res.json([])
      return
    }
    const out: PlanInfo[] = []
    for (const f of fs.readdirSync(PLANS_DIR)) {
      if (!f.endsWith('.md')) continue
      const p = path.join(PLANS_DIR, f)
      try {
        const stat = fs.statSync(p)
        const text = fs.readFileSync(p, 'utf8')
        const m = text.match(/^#\s+(.+)$/m)
        out.push({ file: f, title: m ? m[1].trim() : f, sizeBytes: stat.size, mtimeMs: stat.mtimeMs })
      } catch {
        /* skip unreadable */
      }
    }
    out.sort((a, b) => b.mtimeMs - a.mtimeMs)
    res.json(out)
  }),
)

plansRouter.get(
  '/:file',
  asyncHandler(async (req, res) => {
    if (!RE_PLAN.test(req.params.file)) throw new HttpError(400, 'Invalid plan file')
    const p = safeJoin(PLANS_DIR, req.params.file)
    if (!fs.existsSync(p)) throw new HttpError(404, 'Plan not found')
    res.json({ file: req.params.file, body: fs.readFileSync(p, 'utf8'), mtimeMs: fs.statSync(p).mtimeMs })
  }),
)

plansRouter.put(
  '/:file',
  asyncHandler(async (req, res) => {
    if (!RE_PLAN.test(req.params.file)) throw new HttpError(400, 'Invalid plan file')
    if (typeof req.body?.body !== 'string') throw new HttpError(422, 'body (string) required')
    const p = safeJoin(PLANS_DIR, req.params.file)
    const backup = backupFile(p)
    atomicWrite(p, req.body.body)
    res.json({ ok: true, backup: backup?.archive ?? null })
  }),
)

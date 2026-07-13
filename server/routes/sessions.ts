import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Router } from 'express'
import {
  CLAUDE_DIR,
  HttpError,
  PROJECTS_DIR,
  projectDir,
  transcriptFile,
} from '../paths.js'
import { asyncHandler, clamp, getKnownProjectCwds, listLiveSessions } from '../lib.js'
import { appendLine, backupFile, safeRemove } from '../safe-write.js'
import {
  attachSubagents,
  buildTurns,
  listSubagents,
  readFirstCwd,
  summarize,
} from '../jsonl.js'
import type { MessagesResponse, SubagentInfo } from '../../shared/types.js'

export const sessionsRouter = Router()

/** GET /api/sessions/live — all live Claude processes, with transcript presence. */
sessionsRouter.get(
  '/live',
  asyncHandler(async (_req, res) => {
    const live = listLiveSessions()
    const liveByPid = live
    for (const s of liveByPid) {
      if (s.sessionId && s.encoded) {
        const tf = path.join(PROJECTS_DIR, s.encoded, `${s.sessionId}.jsonl`)
        try {
          s.hasTranscript = fs.existsSync(tf)
        } catch {
          s.hasTranscript = false
        }
      }
    }
    res.json(liveByPid)
  }),
)

/** GET /api/projects/:enc/sessions — list session summaries for a project. */
export const projectSessionsRouter = Router()

projectSessionsRouter.get(
  '/:encoded/sessions',
  asyncHandler(async (req, res) => {
    const dir = projectDir(req.params.encoded)
    if (!fs.existsSync(dir)) {
      res.json([])
      return
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    const summaries = await Promise.all(
      files.map((f) => summarize(path.join(dir, f))),
    )
    summaries.sort((a, b) => (b.lastTs ?? '').localeCompare(a.lastTs ?? ''))
    res.json(summaries)
  }),
)

projectSessionsRouter.get(
  '/:encoded/sessions/:id',
  asyncHandler(async (req, res) => {
    const file = transcriptFile(req.params.encoded, req.params.id)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Session not found')
    const dir = projectDir(req.params.encoded)
    const [summary, subagents] = await Promise.all([
      summarize(file),
      Promise.resolve(listSubagents(path.join(dir, req.params.id))),
    ])
    const live = listLiveSessions().find((s) => s.sessionId === req.params.id)
    res.json({
      summary,
      subagents,
      live: live ? { pid: live.pid, status: live.status, updatedAt: live.updatedAt } : undefined,
    })
  }),
)

/** PATCH /:encoded/sessions/:id — rename via append-only ai-title line. */
projectSessionsRouter.patch(
  '/:encoded/sessions/:id',
  asyncHandler(async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    if (!title) throw new HttpError(422, 'title required')
    if (title.length > 200) throw new HttpError(422, 'title too long (max 200)')
    const file = transcriptFile(req.params.encoded, req.params.id)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Session not found')
    const line = JSON.stringify({ type: 'ai-title', aiTitle: title, sessionId: req.params.id })
    appendLine(file, line)
    res.json({ ok: true, summary: await summarize(file) })
  }),
)

/** DELETE /:encoded/sessions/:id — remove transcript + subagents + file-history + session-env. */
projectSessionsRouter.delete(
  '/:encoded/sessions/:id',
  asyncHandler(async (req, res) => {
    const file = transcriptFile(req.params.encoded, req.params.id)
    const sessionDir = path.join(projectDir(req.params.encoded), req.params.id)
    const fileHistory = path.join(CLAUDE_DIR, 'file-history', req.params.id)
    const sessionEnv = path.join(CLAUDE_DIR, 'session-env', req.params.id)
    if (!fs.existsSync(file) && !fs.existsSync(sessionDir)) {
      throw new HttpError(404, 'Session not found')
    }
    const backup = backupFile(file)
    safeRemove(file, PROJECTS_DIR)
    safeRemove(sessionDir, PROJECTS_DIR)
    safeRemove(fileHistory, CLAUDE_DIR)
    safeRemove(sessionEnv, CLAUDE_DIR)
    res.json({ ok: true, backup: backup?.archive ?? null })
  }),
)

/** Launch a terminal in `cwd` running `claude --resume <sessionId>` (Windows-only for now). */
function launchResume(cwd: string, sessionId: string): void {
  if (process.platform !== 'win32') {
    throw new HttpError(501, `Resume launch not supported on ${process.platform} yet`)
  }
  // `start cmd /k claude --resume <id>` — opens a new console window. The working dir is
  // set via the spawn `cwd` option, so no path quoting is needed in the command string
  // (Node's Windows arg-quoting mangles quoted-path args like `start "" /D "<cwd>" …`).
  const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `claude --resume ${sessionId}`], {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.on('error', (err) => console.error('[resume] spawn error:', err))
  child.unref()
}

/** POST /:encoded/sessions/:id/resume — open a terminal running claude --resume (scoped + validated). */
projectSessionsRouter.post(
  '/:encoded/sessions/:id/resume',
  asyncHandler(async (req, res) => {
    const file = transcriptFile(req.params.encoded, req.params.id) // validates encoded + UUID id
    if (!fs.existsSync(file)) throw new HttpError(404, 'Session not found')
    const cwd = await readFirstCwd(file)
    if (!cwd) throw new HttpError(400, 'Cannot resolve project cwd')
    if (!fs.existsSync(cwd)) throw new HttpError(400, 'Project directory does not exist')
    // allowlist: cwd must be a known project cwd (no launching in arbitrary dirs)
    const known = new Set(getKnownProjectCwds().map((c) => c.replace(/\\/g, '/')))
    if (!known.has(cwd.replace(/\\/g, '/'))) {
      throw new HttpError(400, 'Project cwd not recognized')
    }
    launchResume(cwd, req.params.id)
    res.json({ ok: true, cwd, sessionId: req.params.id })
  }),
)

projectSessionsRouter.get(
  '/:encoded/sessions/:id/messages',
  asyncHandler(async (req, res) => {
    const file = transcriptFile(req.params.encoded, req.params.id)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Session not found')

    const parsed = await buildTurns(file)
    const sessionDir = path.join(projectDir(req.params.encoded), req.params.id)
    const subagents: SubagentInfo[] = listSubagents(sessionDir)
    attachSubagents(parsed.turns, subagents)

    const total = parsed.turns.length
    const limit = clamp(Number.parseInt((req.query.limit as string) ?? '', 10) || 100, 1, 500)
    const after = req.query.after as string | undefined
    let offset: number
    if (after) {
      const idx = parsed.turns.findIndex((t) => t.kind !== 'tool_result' && t.uuid === after)
      offset = idx >= 0 ? idx + 1 : 0
    } else {
      offset = clamp(Number.parseInt((req.query.offset as string) ?? '', 10) || 0, 0, Math.max(0, total))
    }
    const window = parsed.turns.slice(offset, offset + limit)

    const body: MessagesResponse = {
      offset,
      limit,
      total,
      malformedCount: parsed.malformedCount,
      turns: window,
      summary: parsed.summary,
      subagents,
    }
    res.json(body)
  }),
)

projectSessionsRouter.get(
  '/:encoded/sessions/:id/subagents',
  asyncHandler(async (req, res) => {
    const file = transcriptFile(req.params.encoded, req.params.id)
    if (!fs.existsSync(file)) throw new HttpError(404, 'Session not found')
    const sessionDir = path.join(projectDir(req.params.encoded), req.params.id)
    res.json(listSubagents(sessionDir))
  }),
)

projectSessionsRouter.get(
  '/:encoded/sessions/:id/subagents/:agentId/messages',
  asyncHandler(async (req, res) => {
    if (!/^[A-Za-z0-9_-]+$/.test(req.params.agentId)) throw new HttpError(400, 'Invalid agent id')
    const sessionDir = path.join(projectDir(req.params.encoded), req.params.id)
    const tf = path.join(sessionDir, 'subagents', `agent-${req.params.agentId}.jsonl`)
    if (!tf.startsWith(CLAUDE_DIR)) throw new HttpError(400, 'Invalid path')
    if (!fs.existsSync(tf)) throw new HttpError(404, 'Subagent transcript not found')

    const parsed = await buildTurns(tf)
    const total = parsed.turns.length
    const limit = clamp(Number.parseInt((req.query.limit as string) ?? '', 10) || 200, 1, 1000)
    const offset = clamp(Number.parseInt((req.query.offset as string) ?? '', 10) || 0, 0, Math.max(0, total))
    const window = parsed.turns.slice(offset, offset + limit)

    res.json({
      offset,
      limit,
      total,
      malformedCount: parsed.malformedCount,
      turns: window,
      summary: parsed.summary,
    })
  }),
)

import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { DOT_CLAUDE_JSON, HttpError, PROJECTS_DIR, projectDir } from '../paths.js'
import { asyncHandler, listLiveSessions } from '../lib.js'
import { readJsonIfExists } from '../safe-write.js'
import { summarize, readFirstCwd } from '../jsonl.js'
import type { ProjectInfo, ProjectOverview } from '../../shared/types.js'

export const projectsRouter = Router()

projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    if (!fs.existsSync(PROJECTS_DIR)) {
      res.json([])
      return
    }
    const live = listLiveSessions()
    const out: ProjectInfo[] = []

    for (const name of fs.readdirSync(PROJECTS_DIR)) {
      const dir = path.join(PROJECTS_DIR, name)
      let isDir = false
      try {
        isDir = fs.statSync(dir).isDirectory()
      } catch {
        continue
      }
      if (!isDir) continue

      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
      let totalSizeBytes = 0
      let lastActivityMs: number | undefined
      for (const f of files) {
        try {
          const st = fs.statSync(path.join(dir, f))
          totalSizeBytes += st.size
          if (lastActivityMs === undefined || st.mtimeMs > lastActivityMs) lastActivityMs = st.mtimeMs
        } catch {
          /* ignore */
        }
      }

      // Canonical cwd = the `cwd` field inside the first transcript line.
      let cwd = name
      if (files.length) {
        const first = files.sort()[0]
        cwd = (await readFirstCwd(path.join(dir, first))) ?? name
      }

      out.push({
        encoded: name,
        cwd,
        sessionCount: files.length,
        lastActivityMs,
        totalSizeBytes,
        exists: true,
      })
    }

    out.sort((a, b) => (b.lastActivityMs ?? 0) - (a.lastActivityMs ?? 0))
    // mark projects that have a live session
    void live
    res.json(out)
  }),
)

/** GET /:encoded/overview — per-project aggregation (recent sessions, usage, mcp, skills, memory, live). */
projectsRouter.get(
  '/:encoded/overview',
  asyncHandler(async (req, res) => {
    const dir = projectDir(req.params.encoded)
    if (!fs.existsSync(dir)) throw new HttpError(404, 'Project not found')

    // sessions: count + 5 newest by mtime (summarized only for those)
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    const fileStats: Array<{ p: string; mtimeMs: number }> = []
    for (const f of files) {
      const p = path.join(dir, f)
      try {
        fileStats.push({ p, mtimeMs: fs.statSync(p).mtimeMs })
      } catch {
        /* skip */
      }
    }
    fileStats.sort((a, b) => b.mtimeMs - a.mtimeMs)
    const recent = await Promise.all(fileStats.slice(0, 5).map((x) => summarize(x.p)))

    // canonical cwd from newest session
    let cwd = req.params.encoded
    if (fileStats[0]) cwd = (await readFirstCwd(fileStats[0].p)) ?? cwd
    const cwdFwd = cwd.replace(/\\/g, '/')

    // usage + mcp from ~/.claude.json projects[cwdFwd]
    const dotClaude = readJsonIfExists<Record<string, unknown>>(DOT_CLAUDE_JSON) ?? {}
    const projects = (dotClaude.projects ?? {}) as Record<string, unknown>
    const projEntry = (projects[cwdFwd] ?? {}) as Record<string, unknown>
    const num = (k: string): number | undefined =>
      typeof projEntry[k] === 'number' ? (projEntry[k] as number) : undefined
    const str = (k: string): string | undefined =>
      typeof projEntry[k] === 'string' ? (projEntry[k] as string) : undefined
    const usage = {
      lastCost: num('lastCost'),
      lastTotalInputTokens: num('lastTotalInputTokens'),
      lastTotalOutputTokens: num('lastTotalOutputTokens'),
      lastDuration: num('lastDuration'),
      lastStartTime: str('lastStartTime'),
      lastSessionId: str('lastSessionId'),
    }
    const mcpServers = Object.keys((projEntry.mcpServers ?? {}) as Record<string, unknown>)

    // project-level skills count (<cwd>/.claude/skills/*/SKILL.md)
    let skillsCount = 0
    const skillsDir = path.join(cwd, '.claude', 'skills')
    if (fs.existsSync(skillsDir)) {
      try {
        for (const name of fs.readdirSync(skillsDir)) {
          if (fs.existsSync(path.join(skillsDir, name, 'SKILL.md'))) skillsCount++
        }
      } catch {
        /* ignore */
      }
    }

    // memory count (projects/<enc>/memory/*.md, excluding MEMORY.md)
    let memoryCount = 0
    const memDir = path.join(dir, 'memory')
    if (fs.existsSync(memDir)) {
      try {
        memoryCount = fs.readdirSync(memDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').length
      } catch {
        /* ignore */
      }
    }

    const liveS = listLiveSessions().find((s) => s.encoded === req.params.encoded)

    const body: ProjectOverview = {
      encoded: req.params.encoded,
      cwd,
      sessions: { count: files.length, recent },
      usage,
      mcpServers,
      skillsCount,
      memoryCount,
      live: liveS ? { pid: liveS.pid, status: liveS.status } : null,
    }
    res.json(body)
  }),
)

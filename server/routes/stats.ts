import fs from 'node:fs'
import { Router } from 'express'
import { DOT_CLAUDE_JSON } from '../paths.js'
import { asyncHandler } from '../lib.js'
import { readJsonIfExists } from '../safe-write.js'

export const statsRouter = Router()

export interface ProjectStats {
  path: string
  exists: boolean
  lastCost?: number
  lastDuration?: number
  lastTotalInputTokens?: number
  lastTotalOutputTokens?: number
  lastTotalCacheReadInputTokens?: number
  lastLinesAdded?: number
  lastLinesRemoved?: number
  lastSessionId?: string
  lastStartTime?: string
}

export interface StatsResponse {
  projects: ProjectStats[]
  totals: {
    cost: number
    inputTokens: number
    outputTokens: number
    linesAdded: number
    linesRemoved: number
  }
}

statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = readJsonIfExists<Record<string, unknown>>(DOT_CLAUDE_JSON) ?? {}
    const proj = (data.projects ?? {}) as Record<string, Record<string, unknown>>
    const projects: ProjectStats[] = []
    const totals = { cost: 0, inputTokens: 0, outputTokens: 0, linesAdded: 0, linesRemoved: 0 }

    for (const [p, cfg] of Object.entries(proj)) {
      if (!cfg || typeof cfg !== 'object') continue
      const num = (k: string): number | undefined =>
        typeof cfg[k] === 'number' ? (cfg[k] as number) : undefined
      const ps: ProjectStats = {
        path: p,
        exists: fs.existsSync(p),
        lastCost: num('lastCost'),
        lastDuration: num('lastDuration'),
        lastTotalInputTokens: num('lastTotalInputTokens'),
        lastTotalOutputTokens: num('lastTotalOutputTokens'),
        lastTotalCacheReadInputTokens: num('lastTotalCacheReadInputTokens'),
        lastLinesAdded: num('lastLinesAdded'),
        lastLinesRemoved: num('lastLinesRemoved'),
        lastSessionId: typeof cfg.lastSessionId === 'string' ? cfg.lastSessionId : undefined,
        lastStartTime: typeof cfg.lastStartTime === 'string' ? cfg.lastStartTime : undefined,
      }
      projects.push(ps)
      totals.cost += ps.lastCost ?? 0
      totals.inputTokens += ps.lastTotalInputTokens ?? 0
      totals.outputTokens += ps.lastTotalOutputTokens ?? 0
      totals.linesAdded += ps.lastLinesAdded ?? 0
      totals.linesRemoved += ps.lastLinesRemoved ?? 0
    }

    projects.sort((a, b) => (b.lastStartTime ?? '').localeCompare(a.lastStartTime ?? ''))
    res.json({ projects, totals } as StatsResponse)
  }),
)

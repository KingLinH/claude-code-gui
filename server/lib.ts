import fs from 'node:fs'
import path from 'node:path'
import type { NextFunction, Request, Response } from 'express'
import { DOT_CLAUDE_JSON, HttpError, SESSIONS_DIR } from './paths.js'
import { readJsonIfExists } from './safe-write.js'
import type { LiveSession } from '../shared/types.js'

/** Wrap an async route handler: forwards HttpError → status, else 500. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message })
        return
      }
      console.error('[bridge] internal error:', err)
      const msg = err instanceof Error ? err.message : 'Internal error'
      res.status(500).json({ error: msg })
    })
  }
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** base64url encode/decode for safe, opaque path identifiers in URL params. */
export function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

export function unb64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8')
}

/** All project working-directories Claude Code knows about (keys of ~/.claude.json `projects`). */
export function getKnownProjectCwds(): string[] {
  const data = readJsonIfExists<Record<string, unknown>>(DOT_CLAUDE_JSON) ?? {}
  const projects = (data.projects ?? {}) as Record<string, unknown>
  return Object.keys(projects).filter((p) => typeof p === 'string' && p.length > 0)
}

/** Forward encoding used by Claude for project folders: cwd → slug.
 *  Replaces path separators and the drive colon. Note ~/.claude.json stores
 *  project cwds with forward slashes while the OS cwd may use backslashes —
 *  both encode to the same slug only if `/` is included here. */
export function encodeCwd(cwd: string): string {
  return cwd.replace(/[:\\/]/g, '-')
}

/** Read every live-session JSON file (keyed by OS pid). */
export function listLiveSessions(): LiveSession[] {
  if (!fs.existsSync(SESSIONS_DIR)) return []
  const out: LiveSession[] = []
  for (const name of fs.readdirSync(SESSIONS_DIR)) {
    if (!name.endsWith('.json')) continue
    const pid = Number.parseInt(name.replace(/\.json$/, ''), 10)
    if (!Number.isFinite(pid)) continue
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(SESSIONS_DIR, name), 'utf8'),
      ) as Record<string, unknown>
      const cwd = typeof data.cwd === 'string' ? data.cwd : undefined
      out.push({
        pid,
        sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
        cwd,
        name: typeof data.name === 'string' ? data.name : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
        startedAt: typeof data.startedAt === 'number' ? data.startedAt : undefined,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
        version: typeof data.version === 'string' ? data.version : undefined,
        hasTranscript: false,
        encoded: cwd ? encodeCwd(cwd) : undefined,
      })
    } catch {
      /* skip unreadable session file */
    }
  }
  return out
}

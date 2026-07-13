import fs from 'node:fs'
import { Router } from 'express'
import { z } from 'zod'
import { DOT_CLAUDE_JSON, HttpError } from '../paths.js'
import { asyncHandler } from '../lib.js'
import { patchJson, readJsonIfExists } from '../safe-write.js'
import type { McpScope, McpServer } from '../../shared/types.js'

export const mcpRouter = Router()

// --- validation ---
const McpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    type: z.enum(['stdio', 'sse', 'http']).optional(),
    url: z.string().optional(),
  })
  .passthrough() // preserve provider-specific keys (headers, transportType, …)

const McpServersSchema = z.record(z.string(), McpServerSchema)
const GlobalBodySchema = z.object({ mcpServers: McpServersSchema })
const ProjectBodySchema = z.object({ path: z.string().min(1), mcpServers: McpServersSchema })

interface DotClaudeJson {
  mcpServers?: Record<string, McpServer>
  projects?: Record<string, Record<string, unknown>>
  [k: string]: unknown
}

function readDotClaude(): DotClaudeJson {
  return readJsonIfExists<DotClaudeJson>(DOT_CLAUDE_JSON) ?? {}
}

function isAbsPath(p: string): boolean {
  return /^([A-Za-z]:[\\/]|[\\/])/.test(p)
}

/** GET /api/mcp — global + per-project MCP scopes. */
mcpRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = readDotClaude()
    const projects: McpScope['projects'] = []
    const projMap = data.projects ?? {}
    for (const [p, cfg] of Object.entries(projMap)) {
      if (!cfg || typeof cfg !== 'object') continue
      projects.push({
        path: p,
        mcpServers: (cfg.mcpServers as Record<string, McpServer>) ?? {},
        allowedTools: cfg.allowedTools as string[] | undefined,
        mcpContextUris: cfg.mcpContextUris as string[] | undefined,
        enabledMcpjsonServers: cfg.enabledMcpjsonServers as string[] | undefined,
        disabledMcpjsonServers: cfg.disabledMcpjsonServers as string[] | undefined,
        exists: fs.existsSync(p),
      })
    }
    const scope: McpScope = { global: data.mcpServers ?? {}, projects }
    res.json(scope)
  }),
)

/** PUT /api/mcp/global — replace global mcpServers, preserving all other keys. */
mcpRouter.put(
  '/global',
  asyncHandler(async (req, res) => {
    const parsed = GlobalBodySchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(422, `Invalid mcpServers: ${parsed.error.message}`)
    const { backup, mtimeMs } = patchJson<DotClaudeJson>(DOT_CLAUDE_JSON, (cur) => {
      cur.mcpServers = parsed.data.mcpServers as Record<string, McpServer>
    })
    res.json({
      ok: true,
      backup: backup?.archive ?? null,
      mtimeMs,
      count: Object.keys(parsed.data.mcpServers).length,
    })
  }),
)

/** PUT /api/mcp/project — set a single project's mcpServers (path in body). */
mcpRouter.put(
  '/project',
  asyncHandler(async (req, res) => {
    const parsed = ProjectBodySchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(422, `Invalid payload: ${parsed.error.message}`)
    const { path: projPath, mcpServers } = parsed.data
    if (!isAbsPath(projPath)) throw new HttpError(400, 'path must be absolute')
    const { backup, mtimeMs } = patchJson<DotClaudeJson>(DOT_CLAUDE_JSON, (cur) => {
      if (!cur.projects) cur.projects = {}
      if (!cur.projects[projPath] || typeof cur.projects[projPath] !== 'object') {
        cur.projects[projPath] = {}
      }
      cur.projects[projPath]!.mcpServers = mcpServers as Record<string, McpServer>
    })
    res.json({ ok: true, backup: backup?.archive ?? null, mtimeMs, count: Object.keys(mcpServers).length })
  }),
)

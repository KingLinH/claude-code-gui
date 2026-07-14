import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import express from 'express'
import { CLAUDE_DIR, DOT_CLAUDE_JSON } from './paths.js'
import { projectsRouter } from './routes/projects.js'
import { projectSettingsRouter } from './routes/project-settings.js'
import { projectSessionsRouter, sessionsRouter } from './routes/sessions.js'
import { mcpRouter } from './routes/mcp.js'
import { statsRouter } from './routes/stats.js'
import { skillsRouter } from './routes/skills.js'
import { memoryRouter } from './routes/memory.js'
import { settingsRouter } from './routes/settings.js'
import { plansRouter } from './routes/plans.js'
import { searchRouter } from './routes/search.js'

/**
 * Build the Express app. Routes live under /api. Used two ways:
 *  - dev: mounted as Vite middleware (see server/middleware.ts)
 *  - prod: run standalone (npm start) serving dist/ + /api
 */
export function createApp() {
  const app = express()
  const api = express.Router()
  api.use(express.json({ limit: '1mb' }))

  api.get('/health', (_req, res) => {
    res.json({
      ok: true,
      pid: process.pid,
      claudeDir: CLAUDE_DIR,
      dotClaudeJson: DOT_CLAUDE_JSON,
      platform: process.platform,
      nodeVersion: process.version,
    })
  })

  api.use('/projects', projectsRouter)
  api.use('/projects', projectSettingsRouter)
  api.use('/projects', projectSessionsRouter)
  api.use('/sessions', sessionsRouter)
  api.use('/mcp', mcpRouter)
  api.use('/stats', statsRouter)
  api.use('/skills', skillsRouter)
  api.use('/memory', memoryRouter)
  api.use('/settings', settingsRouter)
  api.use('/plans', plansRouter)
  api.use('/search', searchRouter)

  app.use('/api', api)
  return app
}

// --- standalone entry (npm start) -------------------------------------------------
const isMain =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const app = createApp()
  const distDir = path.resolve(process.cwd(), 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
  }
  const port = Number(process.env.PORT) || 4317
  app.listen(port, '127.0.0.1', () => {
    console.log(`[claude-code-gui] http://127.0.0.1:${port}` + (fs.existsSync(distDir) ? `  (serving ${distDir})` : '  (api only — run `npm run build`)'))
  })
}

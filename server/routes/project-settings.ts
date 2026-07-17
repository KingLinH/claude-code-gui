import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { HttpError } from '../paths.js'
import { asyncHandler, resolveProjectCwd } from '../lib.js'
import { atomicWrite, backupFile, readJsonIfExists } from '../safe-write.js'

export const projectSettingsRouter = Router()

function settingsFileFor(cwd: string): string {
  return path.join(cwd, '.claude', 'settings.json')
}

/** GET /:encoded/settings — read the project-level .claude/settings.json (if any). */
projectSettingsRouter.get(
  '/:encoded/settings',
  asyncHandler(async (req, res) => {
    const cwd = resolveProjectCwd(req.params.encoded)
    const file = settingsFileFor(cwd)
    let exists = false
    let mtimeMs = 0
    try {
      const st = fs.statSync(file)
      exists = true
      mtimeMs = st.mtimeMs
    } catch {
      /* file not present yet */
    }
    const settings = exists ? (readJsonIfExists<Record<string, unknown>>(file) ?? {}) : {}
    res.json({ cwd, settings, exists, mtimeMs })
  }),
)

const BodySchema = z.object({ settings: z.record(z.string(), z.unknown()) })

/** PUT /:encoded/settings — write the project-level .claude/settings.json (backup + atomic). */
projectSettingsRouter.put(
  '/:encoded/settings',
  asyncHandler(async (req, res) => {
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(422, 'invalid settings payload')
    const cwd = resolveProjectCwd(req.params.encoded) // allowlist-validated
    const file = settingsFileFor(cwd)
    const backup = backupFile(file) // null if absent (first create)
    atomicWrite(file, JSON.stringify(parsed.data.settings, null, 2))
    res.json({
      ok: true,
      backup: backup?.archive ?? null,
      mtimeMs: fs.statSync(file).mtimeMs,
    })
  }),
)

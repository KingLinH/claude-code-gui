import fs from 'node:fs'
import { Router } from 'express'
import { z } from 'zod'
import { CONFIG_FILE, HttpError, SETTINGS_FILE } from '../paths.js'
import { asyncHandler } from '../lib.js'
import { atomicWrite, backupFile, readJsonIfExists } from '../safe-write.js'

export const settingsRouter = Router()

interface SettingsResponse {
  settings: Record<string, unknown>
  configHasApiKey: boolean
  apiKeyMasked?: string
  mtimeMs: number
}

function maskApiKey(c: Record<string, unknown>): string | undefined {
  const k = c.primaryApiKey
  if (typeof k !== 'string' || !k) return undefined
  if (k.length <= 8) return '••••'
  return `${k.slice(0, 4)}••••${k.slice(-4)}`
}

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = readJsonIfExists<Record<string, unknown>>(SETTINGS_FILE) ?? {}
    const config = readJsonIfExists<Record<string, unknown>>(CONFIG_FILE) ?? {}
    let mtimeMs = 0
    try {
      mtimeMs = fs.statSync(SETTINGS_FILE).mtimeMs
    } catch {
      /* no settings file */
    }
    const body: SettingsResponse = {
      settings,
      configHasApiKey: 'primaryApiKey' in config && typeof config.primaryApiKey === 'string',
      apiKeyMasked: maskApiKey(config),
      mtimeMs,
    }
    res.json(body)
  }),
)

const BodySchema = z.object({ settings: z.record(z.string(), z.unknown()) })

settingsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(422, 'invalid settings payload')
    const backup = backupFile(SETTINGS_FILE)
    atomicWrite(SETTINGS_FILE, JSON.stringify(parsed.data.settings, null, 2))
    res.json({
      ok: true,
      backup: backup?.archive ?? null,
      mtimeMs: fs.statSync(SETTINGS_FILE).mtimeMs,
    })
  }),
)

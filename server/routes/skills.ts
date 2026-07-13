import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { asyncHandler, b64url } from '../lib.js'
import { HttpError, RE_ENCODED, SKILLS_USER_DIR } from '../paths.js'
import { atomicWrite, backupFile, safeRemove } from '../safe-write.js'
import { getSkillDetail, resolveSkillDir, walkSkills } from '../skills-walker.js'

export const skillsRouter = Router()

skillsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(walkSkills())
  }),
)

skillsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!RE_ENCODED.test(req.params.id)) throw new HttpError(400, 'Invalid skill id')
    res.json(getSkillDetail(req.params.id))
  }),
)

/** PUT /:id — replace a skill's SKILL.md (full raw content). */
skillsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!RE_ENCODED.test(req.params.id)) throw new HttpError(400, 'Invalid skill id')
    if (typeof req.body?.content !== 'string') throw new HttpError(422, 'content (string) required')
    const { dir } = resolveSkillDir(req.params.id)
    const mdPath = path.join(dir, 'SKILL.md')
    if (!fs.existsSync(mdPath)) throw new HttpError(404, 'Skill not found')
    backupFile(mdPath)
    atomicWrite(mdPath, req.body.content)
    res.json({ ok: true, detail: getSkillDetail(req.params.id) })
  }),
)

/** POST / — create a user-level skill at ~/.claude/skills/<name>/SKILL.md. */
skillsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!RE_ENCODED.test(name)) throw new HttpError(422, 'valid skill name required')
    const provided = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
    const content = provided || `---\nname: ${name}\ndescription: \n---\n\n`
    const skillDir = path.join(SKILLS_USER_DIR, name)
    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) throw new HttpError(409, 'Skill already exists')
    atomicWrite(path.join(skillDir, 'SKILL.md'), content)
    res.json({ ok: true, id: b64url(skillDir) })
  }),
)

/** DELETE /:id — remove a skill directory (SKILL.md backed up first). */
skillsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!RE_ENCODED.test(req.params.id)) throw new HttpError(400, 'Invalid skill id')
    const { dir, root } = resolveSkillDir(req.params.id)
    const backup = backupFile(path.join(dir, 'SKILL.md'))
    safeRemove(dir, root)
    res.json({ ok: true, backup: backup?.archive ?? null })
  }),
)

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CLAUDE_DIR, HttpError, PLUGINS_DIR, SKILLS_USER_DIR, isUnderRoot } from './paths.js'
import { b64url, getKnownProjectCwds, unb64url } from './lib.js'
import type { SkillDetail, SkillInfo, SkillSource } from '../shared/types.js'

function listDirSafe(dir: string): string[] {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return []
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

function hasSubdir(dir: string, name: string): boolean {
  return fs.existsSync(path.join(dir, name))
}

/** Forward-slash display path for a skill (relative to ~/.claude for user/plugin; cwd-based for project). */
function skillDisplayPath(skillDir: string, source: SkillSource): string {
  if (source.kind === 'project' && source.project) {
    return `${source.project.replace(/\\/g, '/')}/.claude/skills/${path.basename(skillDir)}`
  }
  return path.relative(CLAUDE_DIR, skillDir).replace(/\\/g, '/')
}

function readSkill(skillDir: string, source: SkillSource): SkillInfo | null {
  const mdPath = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(mdPath)) return null
  let parsed: ReturnType<typeof matter>
  try {
    parsed = matter(fs.readFileSync(mdPath, 'utf8'))
  } catch {
    return null
  }
  const fm = (parsed.data ?? {}) as Record<string, unknown>
  const relPath = skillDisplayPath(skillDir, source)

  let tools: string[] | undefined
  if (typeof fm.tools === 'string') {
    tools = fm.tools.split(',').map((s) => s.trim()).filter(Boolean)
  } else if (Array.isArray(fm.tools)) {
    tools = (fm.tools as unknown[]).map((t) => String(t))
  }

  return {
    id: b64url(skillDir), // opaque id = base64url of the absolute skill dir
    name: String(fm.name ?? path.basename(skillDir)),
    description: String(fm.description ?? ''),
    version: fm.version != null ? String(fm.version) : undefined,
    tools,
    source,
    relPath,
    hasScripts: hasSubdir(skillDir, 'scripts'),
    hasReferences: hasSubdir(skillDir, 'references'),
    hasAssets: hasSubdir(skillDir, 'assets'),
  }
}

/** Walk user + plugin + project skills, collecting every SKILL.md. */
export function walkSkills(): SkillInfo[] {
  const out: SkillInfo[] = []

  // user-level skills (~/.claude/skills/<skill>/SKILL.md)
  for (const name of listDirSafe(SKILLS_USER_DIR)) {
    const s = readSkill(path.join(SKILLS_USER_DIR, name), { kind: 'user' })
    if (s) out.push(s)
  }

  // plugin marketplaces
  const mkRoot = path.join(PLUGINS_DIR, 'marketplaces')
  for (const market of listDirSafe(mkRoot)) {
    const mDir = path.join(mkRoot, market)
    if (!fs.existsSync(mDir) || !fs.statSync(mDir).isDirectory()) continue

    // plugins/<plugin>/skills/<skill>
    const pluginsDir = path.join(mDir, 'plugins')
    for (const plugin of listDirSafe(pluginsDir)) {
      const skillsDir = path.join(pluginsDir, plugin, 'skills')
      for (const skill of listDirSafe(skillsDir)) {
        const s = readSkill(path.join(skillsDir, skill), { kind: 'plugin', marketplace: market, plugin })
        if (s) out.push(s)
      }
    }

    // external_plugins/<name>/skills/<skill>
    const extDir = path.join(mDir, 'external_plugins')
    for (const name of listDirSafe(extDir)) {
      const skillsDir = path.join(extDir, name, 'skills')
      for (const skill of listDirSafe(skillsDir)) {
        const s = readSkill(path.join(skillsDir, skill), { kind: 'external', marketplace: market, plugin: name })
        if (s) out.push(s)
      }
    }
  }

  // project-level skills (<cwd>/.claude/skills/<skill>/SKILL.md) for every known project
  for (const cwd of getKnownProjectCwds()) {
    const pSkillsDir = path.join(cwd, '.claude', 'skills')
    for (const name of listDirSafe(pSkillsDir)) {
      const s = readSkill(path.join(pSkillsDir, name), { kind: 'project', project: cwd })
      if (s) out.push(s)
    }
  }

  return out
}

/**
 * Resolve a base64url skill id → {dir, root}, confined to an allowed root:
 * ~/.claude (plugins/ or skills/) OR a known project's .claude/skills/.
 */
export function resolveSkillDir(id: string): { dir: string; root: string } {
  const abs = unb64url(id)
  if (!path.isAbsolute(abs)) throw new HttpError(400, 'Invalid skill id')
  if (isUnderRoot(abs, CLAUDE_DIR)) {
    if (!isUnderRoot(abs, PLUGINS_DIR) && !isUnderRoot(abs, SKILLS_USER_DIR)) {
      throw new HttpError(400, 'Invalid skill id')
    }
    return { dir: abs, root: CLAUDE_DIR }
  }
  for (const cwd of getKnownProjectCwds()) {
    const root = path.join(cwd, '.claude', 'skills')
    if (isUnderRoot(abs, root)) return { dir: abs, root }
  }
  throw new HttpError(400, 'Invalid skill id')
}

/** Resolve a base64url skill id → detail (frontmatter, body, raw, siblings). */
export function getSkillDetail(id: string): SkillDetail {
  const { dir, root } = resolveSkillDir(id)
  const mdPath = path.join(dir, 'SKILL.md')
  if (!fs.existsSync(mdPath)) throw new HttpError(404, 'Skill not found')
  const raw = fs.readFileSync(mdPath, 'utf8')
  const parsed = matter(raw)
  const relPath =
    root === CLAUDE_DIR
      ? path.relative(CLAUDE_DIR, dir).replace(/\\/g, '/')
      : dir.replace(/\\/g, '/')
  return {
    frontmatter: parsed.data ?? {},
    body: parsed.content,
    raw,
    siblings: {
      scripts: listDirSafe(path.join(dir, 'scripts')),
      references: listDirSafe(path.join(dir, 'references')),
      assets: listDirSafe(path.join(dir, 'assets')),
    },
    relPath,
  }
}

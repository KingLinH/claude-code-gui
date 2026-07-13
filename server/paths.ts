import os from 'node:os'
import path from 'node:path'

/** A thrown HttpError is turned into a JSON error response by the route wrapper. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR
  ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
  : path.join(os.homedir(), '.claude')

export const DOT_CLAUDE_JSON = path.join(os.homedir(), '.claude.json')

const SEP = path.sep

function isWin() {
  return process.platform === 'win32'
}

/** True if `abs` is `root` or strictly inside it (case-insensitive on Windows). */
export function isUnderRoot(abs: string, root: string): boolean {
  const a = isWin() ? abs.toLowerCase() : abs
  const r = isWin() ? root.toLowerCase() : root
  return a === r || a.startsWith(r + SEP)
}

/**
 * Confine a relative path under `root`. Rejects absolute inputs and any `..`
 * traversal. Returns the resolved absolute path.
 */
export function safeJoin(root: string, rel: string): string {
  if (path.isAbsolute(rel)) throw new HttpError(400, 'Absolute path not allowed')
  const norm = path.normalize(rel)
  const segments = norm.split(SEP)
  if (segments.includes('..')) throw new HttpError(400, 'Path traversal not allowed')
  const resolved = path.resolve(root, rel)
  if (!isUnderRoot(resolved, root)) throw new HttpError(400, 'Path escapes allowed root')
  return resolved
}

// --- well-known locations under the Claude dir ---
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')
export const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions')
export const PLANS_DIR = path.join(CLAUDE_DIR, 'plans')
export const PLUGINS_DIR = path.join(CLAUDE_DIR, 'plugins')
export const SKILLS_USER_DIR = path.join(CLAUDE_DIR, 'skills')
export const MEMORY_HISTORY = path.join(CLAUDE_DIR, 'history.jsonl')
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json')
export const CONFIG_FILE = path.join(CLAUDE_DIR, 'config.json')

// --- filename allowlists (param validators) ---
export const RE_ENCODED = /^[A-Za-z0-9._-]+$/
export const RE_FILE_MD = /^[\w.()-]+\.md$/
export const RE_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Resolve the transcript dir for an encoded-cwd slug, validating the segment. */
export function projectDir(encoded: string): string {
  if (!RE_ENCODED.test(encoded)) throw new HttpError(400, 'Invalid project id')
  const dir = path.join(PROJECTS_DIR, encoded)
  return dir
}

/** Resolve a transcript file, validating both segments. */
export function transcriptFile(encoded: string, sessionId: string): string {
  if (!RE_UUID.test(sessionId)) throw new HttpError(400, 'Invalid session id')
  const file = path.join(projectDir(encoded), `${sessionId}.jsonl`)
  return file
}

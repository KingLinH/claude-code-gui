import fs from 'node:fs'
import path from 'node:path'
import { CLAUDE_DIR, HttpError, isUnderRoot } from './paths.js'

const BACKUPS_DIR = path.join(CLAUDE_DIR, 'backups')

function ensureBackupsDir(): string {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true })
  return BACKUPS_DIR
}

/** Read+parse JSON if the file exists; null otherwise (never throws). */
export function readJsonIfExists<T = unknown>(absPath: string): T | null {
  try {
    if (!fs.existsSync(absPath)) return null
    return JSON.parse(fs.readFileSync(absPath, 'utf8')) as T
  } catch {
    return null
  }
}

export interface BackupResult {
  bak: string
  archive: string
}

/**
 * Back up a file before overwriting: writes `<file>.bak` next to it AND a
 * timestamped copy under `.claude/backups/`. Returns null if absent.
 */
export function backupFile(absPath: string): BackupResult | null {
  if (!fs.existsSync(absPath)) return null
  const dir = ensureBackupsDir()
  const base = path.basename(absPath)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const bak = absPath + '.bak'
  const archive = path.join(dir, `${base}.${ts}.bak`)
  fs.copyFileSync(absPath, bak)
  fs.copyFileSync(absPath, archive)
  return { bak, archive }
}

/** Atomic write: temp file in the same dir, then rename (crash-safe replace). */
export function atomicWrite(absPath: string, content: string): void {
  const dir = path.dirname(absPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(absPath)}.tmp-${process.pid}`)
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, absPath)
}

/**
 * Append a single line non-destructively (e.g. an ai-title line for session rename).
 * Backs up first, then a single O_APPEND write. Returns the backup (null if absent).
 */
export function appendLine(absPath: string, line: string): BackupResult | null {
  const backup = backupFile(absPath)
  fs.appendFileSync(absPath, line.endsWith('\n') ? line : `${line}\n`, 'utf8')
  return backup
}

/**
 * Recursively remove a file/dir only if strictly under `root` (blocks traversal).
 * Returns false (no-op) if the target doesn't exist; never throws on missing.
 */
export function safeRemove(absPath: string, root: string): boolean {
  if (!isUnderRoot(absPath, root)) throw new HttpError(400, 'Path escapes allowed root')
  if (!fs.existsSync(absPath)) return false
  fs.rmSync(absPath, { recursive: true, force: true })
  return true
}

/**
 * Read-modify-write a JSON file safely (Claude Code may be writing it concurrently):
 * re-reads the latest file just before patching, applies `patch` to a fresh object,
 * backs up, then atomically writes. Returns the new object + backup info.
 */
export function patchJson<T extends Record<string, unknown>>(
  absPath: string,
  patch: (current: T) => T | void,
): { next: T; backup: BackupResult | null; mtimeMs: number } {
  const current = (readJsonIfExists<T>(absPath) ?? ({} as T)) as T
  const result = patch(current)
  const next = (result === undefined ? current : result) as T
  const backup = backupFile(absPath)
  atomicWrite(absPath, JSON.stringify(next, null, 2))
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(absPath).mtimeMs
  } catch {
    /* ignore */
  }
  return { next, backup, mtimeMs }
}

import { spawn, spawnSync } from 'node:child_process'
import { HttpError } from './paths.js'

/** Single-quote a shell argument (POSIX). cwd comes from a known-project allowlist,
 *  but we still escape defensively so a path with a quote/space can't inject commands. */
function escapeShellArg(s: string): string {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

/** True if `cmd` is resolvable on PATH (POSIX `command -v` / Windows `where`). */
function commandExists(cmd: string): boolean {
  try {
    const r =
      process.platform === 'win32'
        ? spawnSync('where', [cmd], { stdio: 'ignore' })
        : spawnSync('sh', ['-c', `command -v ${escapeShellArg(cmd)}`], { stdio: 'ignore' })
    return r.status === 0
  } catch {
    return false
  }
}

/** Spawn a detached child whose lifetime is independent of the bridge; log spawn errors. */
function detachSpawn(cmd: string, args: string[], opts?: { cwd?: string; windowsHide?: boolean }): void {
  const child = spawn(cmd, args, {
    cwd: opts?.cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: opts?.windowsHide ?? false,
  })
  child.on('error', (err) => console.error('[launch] spawn error:', err))
  child.unref()
}

/**
 * Open a terminal in `cwd` running `claude <claudeArgs>` (cross-platform).
 * `claudeArgs` is the verbatim string appended after `claude` — e.g.
 * '--resume <id>' to resume a session, '' to start a fresh interactive session.
 */
export function launchClaude(cwd: string, claudeArgs: string): void {
  const args = claudeArgs.trim()
  const claudeCmd = args ? `claude ${args}` : 'claude'

  if (process.platform === 'win32') {
    // `start cmd /k claude …` — opens a new console window. The working dir is set
    // via the spawn `cwd` option, so no path quoting is needed in the command string
    // (Node's Windows arg-quoting mangles quoted-path args like `start "" /D "<cwd>" …`).
    detachSpawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', claudeCmd], { cwd, windowsHide: false })
    return
  }

  if (process.platform === 'darwin') {
    // macOS: tell Terminal.app to run the command in a new window.
    const shellCmd = `cd ${escapeShellArg(cwd)} && ${claudeCmd}`
    const asString = shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"') // embed into AppleScript string
    detachSpawn('osascript', [
      '-e',
      `tell application "Terminal" to do script "${asString}"`,
      '-e',
      'tell application "Terminal" to activate',
    ])
    return
  }

  // Linux: each terminal has its own "run a command" flag — try them in preference order.
  const shellCmd = `cd ${escapeShellArg(cwd)} && ${claudeCmd}; exec bash`
  const specs: Array<{ cmd: string; args: (s: string) => string[] }> = [
    { cmd: 'x-terminal-emulator', args: (s) => ['-e', 'bash', '-lc', s] },
    { cmd: 'gnome-terminal', args: (s) => ['--', 'bash', '-lc', s] },
    { cmd: 'konsole', args: (s) => ['-e', 'bash', '-lc', s] },
    { cmd: 'xfce4-terminal', args: (s) => ['-x', 'bash', '-lc', s] },
    { cmd: 'lxterminal', args: (s) => ['-e', 'bash', '-lc', s] },
    { cmd: 'alacritty', args: (s) => ['-e', 'bash', '-lc', s] },
    { cmd: 'kitty', args: (s) => ['bash', '-lc', s] },
  ]
  // Honor $TERMINAL first (user override), then probe known emulators.
  if (process.env.TERMINAL && commandExists(process.env.TERMINAL)) {
    detachSpawn(process.env.TERMINAL, ['-e', 'bash', '-lc', shellCmd])
    return
  }
  const hit = specs.find((s) => commandExists(s.cmd))
  if (!hit) {
    throw new HttpError(
      501,
      'No supported terminal emulator found. Set the $TERMINAL env var to your terminal (e.g. gnome-terminal, konsole, kitty).',
    )
  }
  detachSpawn(hit.cmd, hit.args(shellCmd))
}

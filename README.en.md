# Claude Code GUI

[![CI](https://github.com/KingLinH/claude-code-gui/actions/workflows/ci.yml/badge.svg)](https://github.com/KingLinH/claude-code-gui/actions/workflows/ci.yml)

[English](README.en.md) | [简体中文](README.md)

A browser-based visualization & management interface for Claude Code's local data
(`~/.claude`), styled after the OpenAI Codex client (Linear-like developer tool
aesthetic, with a light/dark toggle). Browse sessions/transcripts with tool calls &
diffs, manage MCP / Skills / Memory / Settings / Plans (incl. project-level
permissions/hooks), run a cross-data global search, open a `Ctrl/Cmd+K` command
palette, and one-click `claude --resume` back into a project.

## Stack

Vue 3 · Vite · Naive UI · Tailwind · Pinia · Vue Router · TypeScript.
The Node bridge is **Express mounted as Vite middleware** → single process, single
port (5173), same-origin, zero CORS.

## i18n

Lightweight built-in i18n (no dependency): `src/i18n/{index,zh,en}.ts`. A `中文 / EN`
toggle in the sidebar switches all UI chrome instantly and persists the choice to
`localStorage`. `t('key', {params})` reads a reactive `locale` ref, so any template
using it re-renders on switch. Add a locale by dropping in another dict file and
registering it in `index.ts`. Data content (session titles, memories, plans) is shown
as-is — only the chrome is translated.

## Keyboard shortcuts

- `Ctrl/Cmd+K` — command palette (navigate the 9 pages, toggle theme/language, jump to search)
- `Ctrl/Cmd+J` — toggle light/dark theme
- `Ctrl/Cmd+Shift+L` — toggle 中文 / English
- `/` — jump to global search
- Single-key shortcuts are disabled while typing in a field

## Prerequisites

- **Node.js ≥ 18** (uses ESM, `node:` imports, `import.meta.url`).
- **Claude Code** installed and used at least once — this tool reads its `~/.claude`
  data (resolved via `CLAUDE_CONFIG_DIR` env, default `~/.claude`).

## Run

### One-click Windows service (recommended)

Make sure Node.js 18 or newer is installed, then double-click this file in the project directory:

```text
start-service.bat
```

When needed, the script installs dependencies, builds the application, starts it in the background, and opens:

```text
http://127.0.0.1:4317
```

To stop the service, double-click:

```text
stop-service.bat
```

Runtime logs are saved as `claude-code-gui.log` and `claude-code-gui.log.err` in the project directory.

### Development mode

```bash
npm install
npm run dev      # → http://127.0.0.1:5173
```

Other scripts:

```bash
npm run typecheck   # vue-tsc --noEmit
npm run build       # typecheck + vite build → dist/
npm start           # standalone bridge (port 4317) serving dist/ + /api
```

## What it reads (all under `~/.claude/`)

| Domain | Location |
|---|---|
| Sessions/transcripts | `projects/<encoded-cwd>/<sessionId>.jsonl` |
| Subagent transcripts | `projects/<enc>/<sessionId>/subagents/agent-*.jsonl` |
| Live sessions | `sessions/<pid>.json` |
| MCP | `~/.claude.json` (`mcpServers` global + per-project) |
| Skills | `plugins/marketplaces/*/plugins/*/skills/*/SKILL.md` |
| Memory | `projects/<enc>/memory/*.md` (+ `MEMORY.md` index) |
| Usage stats | `~/.claude.json` per-project `last*` fields |

## Architecture notes

- **Transcript parsing** (`server/jsonl.ts`): streams JSONL, keys off the **root-level**
  line `type` only (there is also a nested `message.content[].type` — do not confuse
  them). Pairs `tool_result` blocks into their `tool_use` calls by id. Large (5 MB)
  transcripts parse in ~200 ms; messages are returned windowed (`?offset&limit` or
  `?after=<uuid>`).
- **Path safety** (`server/paths.ts`): root confinement + traversal rejection +
  filename allowlists. `:encoded`/`:id`/`:agentId` are validated.
- **Theming**: CSS custom-property tokens (`src/styles/theme-tokens.css`) consumed by
  both Tailwind and Naive UI `themeOverrides` (`src/theme.ts`); `<html data-theme>`
  switches light/dark, driven by `useTheme` (`src/composables/useTheme.ts`)
  (localStorage + `prefers-color-scheme`).

## Status

- **v1 (done)**: Sessions list + Transcript viewer (thinking, markdown, tool calls,
  Edit/Write diffs, collapsible results, expandable subagent threads), live-session
  badges, dashboard.
- **v1.1 (done)**: MCP server editor (`PUT /api/mcp/{global,project}` with Zod
  validation + backup + atomic write preserving all other `.claude.json` keys);
  `/api/stats` aggregating per-project `last*` usage → dashboard tokens/cost/lines.
- **v1.2 (done)**: Skills browser (walks plugin marketplaces + user skills, renders
  SKILL.md); Memory viewer/editor (list + rendered view + raw edit + create/delete,
  backup before every write).
- **v1.3 (done)**: Settings editor (`settings.json` model + `includeCoAuthoredBy` +
  env key-value editor + read-only raw mirror; `config.json` API key masked); Plans
  reader/editor (first-H1 titles, rendered markdown + raw edit).
- **v1.4 (done)**: ① performance — `highlight.js` loaded on demand (common-language
  subset; `MarkdownBlock` chunk ~1 MB → ~206 KB) + an mtime-invalidated cache on
  `summarize()`; ② cross-platform resume — macOS (osascript) / Linux (terminal
  auto-detect) open a terminal running `claude --resume`; ③ light/dark theme toggle
  (light tokens already existed; added a `useTheme` composable + Naive light overrides
  + sidebar switch + a shared `--code-bg`); ④ `Ctrl/Cmd+K` command palette + global
  shortcuts; ⑤ project-level `.claude/settings.json` editor (permissions
  allow/deny/ask + defaultMode + hooks + env + model). Also fixes `encodeCwd` missing
  `/` (forward-slash project paths now encode correctly).
- **Editing (done)**: session **rename** (append-only `ai-title` line) + **delete**
  (transcript + subagents + `file-history/` + `session-env/`, backup first); Skills
  full **CRUD** (create → user `~/.claude/skills/`, edit any `SKILL.md`, delete). All
  writes reuse backup + path-confinement; deletes are confirmed in-UI.
- **Projects (done)**: `/projects` cross-project table + `/projects/:encoded` per-project
  overview (recent sessions, last usage, project skills/MCP/memory counts) deep-linking
  into each module.
- **Reconnect to Claude (done)**: one-click **resume** — opens a terminal in the project
  cwd running `claude --resume <id>`. **Cross-platform**: Windows / macOS (Terminal) /
  Linux (terminal auto-detect).
- **Global search (done)**: `/search` across sessions + memory + skills + plans, with
  highlighted snippets and click-to-navigate.
- **i18n (done)**: built-in 中文 / English toggle.
- Production build verified (`npm run build` → `dist/`, served by `npm start`).

### Possible follow-ups
- Virtualize the transcript list for very long sessions (currently paginated
  load-more; transcript blocks have variable height, so this needs dynamic measuring).

> v1.4 shipped: on-demand `highlight.js`, `summarize()` cache, project-level settings
> editor, cross-platform resume, light/dark theme, command palette.

## Platform notes

- The **resume** feature ("继续会话" / open a terminal running `claude --resume`) is
  **cross-platform**: Windows / macOS (Terminal, via osascript) / Linux (prefers
  `$TERMINAL`, then probes gnome-terminal / konsole / xfce4-terminal / lxterminal /
  alacritty / kitty; returns HTTP 501 if none are installed).
- All file paths use `path.join`/`path.resolve`; cwd comparisons normalize separators.
  Tested on Windows; should work on macOS/Linux apart from resume.

## Configuration (env vars)

- `CLAUDE_CONFIG_DIR` — override the Claude data directory (default `~/.claude`).
- `PORT` — port for the standalone server (`npm start`, default 4317).

## License

[MIT](./LICENSE) © KingLinH


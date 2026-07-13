# Claude Code GUI

A browser-based visualization & management interface for Claude Code's local data
(`~/.claude`), styled after the OpenAI Codex client (dark, Linear-like developer
tool aesthetic). Browse sessions/transcripts with tool calls & diffs, manage
MCP / Skills / Memory / Settings / Plans, run a cross-data global search, and
one-click `claude --resume` back into a project.

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

## Prerequisites

- **Node.js ≥ 18** (uses ESM, `node:` imports, `import.meta.url`).
- **Claude Code** installed and used at least once — this tool reads its `~/.claude`
  data (resolved via `CLAUDE_CONFIG_DIR` env, default `~/.claude`).

## Run

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
  both Tailwind and Naive UI `themeOverrides` (`src/theme.ts`).

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
- **Editing (done)**: session **rename** (append-only `ai-title` line) + **delete**
  (transcript + subagents + `file-history/` + `session-env/`, backup first); Skills
  full **CRUD** (create → user `~/.claude/skills/`, edit any `SKILL.md`, delete). All
  writes reuse backup + path-confinement; deletes are confirmed in-UI.
- **Projects (done)**: `/projects` cross-project table + `/projects/:encoded` per-project
  overview (recent sessions, last usage, project skills/MCP/memory counts) deep-linking
  into each module.
- **Reconnect to Claude (done)**: one-click **resume** — opens a terminal in the project
  cwd running `claude --resume <id>`. **Windows-only** for now (see Platform notes).
- **Global search (done)**: `/search` across sessions + memory + skills + plans, with
  highlighted snippets and click-to-navigate.
- **i18n (done)**: built-in 中文 / English toggle.
- Production build verified (`npm run build` → `dist/`, served by `npm start`).

### Possible follow-ups
- Code-split `highlight.js` (the `MarkdownBlock` chunk is ~1 MB because all languages
  register; import only the languages you use).
- Virtualize the transcript list for very long sessions (currently paginated
  load-more).
- Parse-index cache for huge transcripts (seek by uuid instead of re-streaming).
- Project-level `.claude/settings.json` (permissions/hooks) editor.
- macOS/Linux launch for the resume feature (currently Windows-only).

## Platform notes

- The **resume** feature ("继续会话" / open a terminal running `claude --resume`) is
  **Windows-only**. On macOS/Linux the endpoint returns HTTP 501 — the rest of the app
  works everywhere. Cross-platform launch is a welcome contribution.
- All file paths use `path.join`/`path.resolve`; cwd comparisons normalize separators.
  Tested on Windows; should work on macOS/Linux apart from resume.

## Configuration (env vars)

- `CLAUDE_CONFIG_DIR` — override the Claude data directory (default `~/.claude`).
- `PORT` — port for the standalone server (`npm start`, default 4317).

## License

[MIT](./LICENSE) © <your-name>


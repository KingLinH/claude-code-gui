import fs from 'node:fs'
import readline from 'node:readline'
import path from 'node:path'
import type {
  RawLine,
  SessionSummary,
  SubagentInfo,
  ToolCall,
  Turn,
  Usage,
} from '../shared/types.js'

/** A content block read loosely (avoids discriminated-union narrowing issues). */
type AnyBlock = { type: string; [k: string]: unknown }

/** Max chars of a tool_result we serialize into the API payload. */
const RESULT_MAX = 40_000

function truncate(s: string, max = RESULT_MAX): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`
}

function stringifyToolResult(
  content: string | Array<{ type: 'text'; text: string }> | unknown,
): string {
  if (typeof content === 'string') return truncate(content)
  if (Array.isArray(content)) {
    return truncate(
      content
        .map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: string }).text) : JSON.stringify(c)))
        .join('\n'),
    )
  }
  return truncate(JSON.stringify(content))
}

/** Stream a .jsonl file, invoking `onLine` for each parsed object. Counts malformed lines. */
async function streamLines(
  file: string,
  onLine: (line: RawLine) => void,
): Promise<{ malformed: number }> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let malformed = 0
  for await (const raw of rl) {
    if (!raw || !raw.trim()) continue
    try {
      onLine(JSON.parse(raw) as RawLine)
    } catch {
      malformed++
    }
  }
  return { malformed }
}

function hasSubagents(sessionDir: string): boolean {
  const sub = path.join(sessionDir, 'subagents')
  try {
    if (!fs.existsSync(sub)) return false
    return fs.readdirSync(sub).some((n) => n.startsWith('agent-') && n.endsWith('.meta.json'))
  } catch {
    return false
  }
}

/** Lightweight single pass → summary only (for the session LIST). No turn construction. */
export async function summarize(
  file: string,
  opts: { hasSubagents?: boolean } = {},
): Promise<SessionSummary & { malformedCount: number }> {
  const stat = fs.statSync(file)
  const acc = {
    aiTitle: undefined as string | undefined,
    lastPrompt: undefined as string | undefined,
    agentName: undefined as string | undefined,
    mode: undefined as string | undefined,
    permissionMode: undefined as string | undefined,
    firstTs: undefined as string | undefined,
    lastTs: undefined as string | undefined,
    messageCount: 0,
    durationMs: undefined as number | undefined,
  }

  const { malformed } = await streamLines(file, (l) => {
    if (l.timestamp) {
      if (!acc.firstTs) acc.firstTs = l.timestamp
      acc.lastTs = l.timestamp
    }
    if (l.type === 'ai-title' && l.aiTitle) acc.aiTitle = l.aiTitle
    if (l.type === 'last-prompt' && l.lastPrompt) acc.lastPrompt = l.lastPrompt
    if (l.type === 'agent-name' && l.agentName) acc.agentName = l.agentName
    if (l.type === 'mode' && l.mode) acc.mode = l.mode
    if (l.type === 'permission-mode' && l.permissionMode) acc.permissionMode = l.permissionMode
    if (l.type === 'system' && l.subtype === 'turn_duration' && typeof l.durationMs === 'number') {
      acc.durationMs = l.durationMs
    }
    if (l.type === 'user' || l.type === 'assistant') acc.messageCount++
  })

  return {
    sessionId: path.basename(file, '.jsonl'),
    sizeBytes: stat.size,
    mtimeMs: stat.mtimeMs,
    aiTitle: acc.aiTitle,
    lastPrompt: acc.lastPrompt,
    agentName: acc.agentName,
    mode: acc.mode,
    permissionMode: acc.permissionMode,
    firstTs: acc.firstTs,
    lastTs: acc.lastTs,
    messageCount: acc.messageCount,
    durationMs: acc.durationMs,
    // subagents live at <projectDir>/<sessionId>/subagents (NOT <projectDir>/subagents)
    hasSubagents: opts.hasSubagents ?? hasSubagents(path.join(path.dirname(file), path.basename(file, '.jsonl'))),
    malformedCount: malformed,
  }
}

export interface ParsedTranscript {
  summary: Omit<SessionSummary, 'sizeBytes' | 'mtimeMs' | 'hasSubagents'>
  turns: Turn[]
  malformedCount: number
}

/** Full parse → render-model turns + summary. Pairs tool_results into tool_use calls. */
export async function buildTurns(file: string): Promise<ParsedTranscript> {
  const acc = {
    sessionId: path.basename(file, '.jsonl'),
    aiTitle: undefined as string | undefined,
    lastPrompt: undefined as string | undefined,
    agentName: undefined as string | undefined,
    mode: undefined as string | undefined,
    permissionMode: undefined as string | undefined,
    firstTs: undefined as string | undefined,
    lastTs: undefined as string | undefined,
    messageCount: 0,
    durationMs: undefined as number | undefined,
  }
  const conversation: RawLine[] = []

  const { malformed } = await streamLines(file, (l) => {
    if (l.timestamp) {
      if (!acc.firstTs) acc.firstTs = l.timestamp
      acc.lastTs = l.timestamp
    }
    if (l.type === 'ai-title' && l.aiTitle) acc.aiTitle = l.aiTitle
    if (l.type === 'last-prompt' && l.lastPrompt) acc.lastPrompt = l.lastPrompt
    if (l.type === 'agent-name' && l.agentName) acc.agentName = l.agentName
    if (l.type === 'mode' && l.mode) acc.mode = l.mode
    if (l.type === 'permission-mode' && l.permissionMode) acc.permissionMode = l.permissionMode
    if (l.type === 'system' && l.subtype === 'turn_duration' && typeof l.durationMs === 'number') {
      acc.durationMs = l.durationMs
    }
    if (l.type === 'user' || l.type === 'assistant') {
      acc.messageCount++
      conversation.push(l)
    }
  })

  const turns: Turn[] = []

  for (const l of conversation) {
    const ts = l.timestamp ?? ''
    const uuid = l.uuid ?? ''
    const msg = l.message

    if (l.type === 'user') {
      const content = msg?.content
      if (typeof content === 'string') {
        turns.push({ kind: 'user', uuid, ts, text: content })
      } else if (Array.isArray(content)) {
        const textParts: string[] = []
        const results: Array<{ toolUseId: string; content: string; isError: boolean }> = []
        for (const raw of content) {
          const block = raw as AnyBlock
          if (block.type === 'tool_result') {
            results.push({
              toolUseId: String(block.tool_use_id ?? ''),
              content: stringifyToolResult(block.content),
              isError: !!block.is_error,
            })
          } else if (block.type === 'text' && typeof block.text === 'string') {
            textParts.push(block.text)
          }
        }
        if (textParts.length) turns.push({ kind: 'user', uuid, ts, text: textParts.join('\n\n') })
        for (const r of results) {
          turns.push({ kind: 'tool_result', uuid, ts, toolUseId: r.toolUseId, content: r.content, isError: r.isError })
        }
      }
    } else if (l.type === 'assistant') {
      const thinking: string[] = []
      const text: string[] = []
      const toolCalls: ToolCall[] = []
      let model: string | undefined
      let usage: Usage | undefined
      const content = msg?.content
      if (Array.isArray(content)) {
        for (const raw of content) {
          const block = raw as AnyBlock
          if (block.type === 'thinking' && typeof block.thinking === 'string') thinking.push(block.thinking)
          else if (block.type === 'redacted_thinking') thinking.push('[redacted thinking]')
          else if (block.type === 'text' && typeof block.text === 'string') text.push(block.text)
          else if (block.type === 'tool_use') {
            const input =
              block.input && typeof block.input === 'object'
                ? (block.input as Record<string, unknown>)
                : {}
            toolCalls.push({ id: String(block.id ?? ''), name: String(block.name ?? ''), input })
          }
        }
        model = msg?.model
        usage = msg?.usage
      }
      turns.push({ kind: 'assistant', uuid, ts, model, thinking, text, toolCalls, usage })
    }
  }

  // --- Pair tool_results into the tool_use that requested them (O(n)). ---
  const resultsByToolUseId = new Map<string, number[]>()
  for (let j = 0; j < turns.length; j++) {
    const t = turns[j]
    if (t.kind === 'tool_result') {
      const arr = resultsByToolUseId.get(t.toolUseId)
      if (arr) arr.push(j)
      else resultsByToolUseId.set(t.toolUseId, [j])
    }
  }
  const consumed = new Set<number>()
  for (const t of turns) {
    if (t.kind !== 'assistant') continue
    for (const tc of t.toolCalls) {
      const arr = resultsByToolUseId.get(tc.id)
      if (arr && arr.length) {
        const j = arr.shift()!
        const r = turns[j] as Extract<Turn, { kind: 'tool_result' }>
        tc.result = { content: r.content, isError: r.isError }
        consumed.add(j)
      }
    }
  }

  const visible = turns.filter((_, idx) => {
    const t = turns[idx]
    return !(t.kind === 'tool_result' && consumed.has(idx))
  })

  return {
    summary: {
      sessionId: acc.sessionId,
      aiTitle: acc.aiTitle,
      lastPrompt: acc.lastPrompt,
      agentName: acc.agentName,
      mode: acc.mode,
      permissionMode: acc.permissionMode,
      firstTs: acc.firstTs,
      lastTs: acc.lastTs,
      messageCount: acc.messageCount,
      durationMs: acc.durationMs,
      malformedCount: malformed,
    },
    turns: visible,
    malformedCount: malformed,
  }
}

/** Read subagent metadata for a session dir. */
export function listSubagents(sessionDir: string): SubagentInfo[] {
  const sub = path.join(sessionDir, 'subagents')
  if (!fs.existsSync(sub)) return []
  const out: SubagentInfo[] = []
  for (const name of fs.readdirSync(sub)) {
    const m = name.match(/^agent-(.+)\.meta\.json$/)
    if (!m) continue
    const agentId = m[1]
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(sub, name), 'utf8')) as Record<string, unknown>
      let sizeBytes = 0
      const tf = path.join(sub, `agent-${agentId}.jsonl`)
      if (fs.existsSync(tf)) {
        try {
          sizeBytes = fs.statSync(tf).size
        } catch {
          /* ignore */
        }
      }
      out.push({
        agentId,
        agentType: String(meta.agentType ?? 'unknown'),
        description: String(meta.description ?? ''),
        toolUseId: String(meta.toolUseId ?? ''),
        spawnDepth: typeof meta.spawnDepth === 'number' ? meta.spawnDepth : 1,
        sizeBytes,
      })
    } catch {
      /* skip unreadable meta */
    }
  }
  return out
}

/** Read the `cwd` field from the first parseable line of a transcript. */
export async function readFirstCwd(file: string): Promise<string | undefined> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  try {
    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as { cwd?: string }
        if (obj.cwd) return obj.cwd
      } catch {
        /* keep scanning */
      }
    }
  } finally {
    rl.close()
  }
  return undefined
}

/** Attach subagent metadata to matching tool_use calls (mutates turns in place). */
export function attachSubagents(turns: Turn[], subagents: SubagentInfo[]): void {
  const byToolUseId = new Map(subagents.map((s) => [s.toolUseId, s]))
  if (!byToolUseId.size) return
  for (const t of turns) {
    if (t.kind !== 'assistant') continue
    for (const tc of t.toolCalls) {
      const s = byToolUseId.get(tc.id)
      if (s) {
        tc.subagent = {
          agentId: s.agentId,
          agentType: s.agentType,
          description: s.description,
          spawnDepth: s.spawnDepth,
        }
      }
    }
  }
}

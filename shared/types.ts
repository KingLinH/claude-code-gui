/**
 * Shared types imported by BOTH the Node bridge (server/) and the Vue client (src/).
 *
 * Transcript parsing note: each .jsonl line has TWO `type` fields:
 *   - root-level line `type`  (LineType: 'assistant' | 'user' | 'system' | ...)
 *   - nested `message.content[].type` (ContentBlock: 'thinking' | 'text' | 'tool_use' | 'tool_result')
 * The parser keys off the ROOT-level `type` only; content blocks are read via message.content.
 */

// ---------------------------------------------------------------------------
// Raw transcript line (one JSON object per .jsonl line)
// ---------------------------------------------------------------------------

export type LineType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'mode'
  | 'permission-mode'
  | 'file-history-snapshot'
  | 'attachment'
  | 'ai-title'
  | 'agent-name'
  | 'last-prompt'
  | 'summary'
  | 'queue-operation'
  | string // tolerate unknown future types

export interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'redacted_thinking'; data?: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | {
      type: 'tool_result'
      tool_use_id: string
      content: string | Array<{ type: 'text'; text: string }>
      is_error?: boolean
    }
  | { type: string; [k: string]: unknown }

export interface Message {
  role: 'user' | 'assistant' | string
  content: string | ContentBlock[]
  model?: string
  usage?: Usage
}

export interface RawLine {
  type: LineType
  uuid?: string
  parentUuid?: string | null
  timestamp?: string
  sessionId?: string
  cwd?: string
  version?: string
  gitBranch?: string
  slug?: string
  isSidechain?: boolean
  userType?: string
  message?: Message
  mode?: string
  permissionMode?: string
  aiTitle?: string
  agentName?: string
  lastPrompt?: string
  leafUuid?: string
  subtype?: string
  durationMs?: number
  messageCount?: number
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Render model (built by the bridge from RawLines)
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  /** Paired from a later user-line tool_result block; undefined if unpaired/orphan. */
  result?: { content: string; isError: boolean; isTruncated?: boolean }
  /** If this tool_use spawned a subagent, its metadata (lazy-loaded on expand). */
  subagent?: { agentId: string; agentType: string; description: string; spawnDepth: number }
}

export type Turn =
  | { kind: 'user'; uuid: string; ts: string; text: string; isMeta?: boolean }
  | {
      kind: 'assistant'
      uuid: string
      ts: string
      model?: string
      thinking: string[]
      text: string[]
      toolCalls: ToolCall[]
      usage?: Usage
    }
  | {
      kind: 'tool_result'
      uuid: string
      ts: string
      toolUseId: string
      content: string
      isError: boolean
    }

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface SessionSummary {
  sessionId: string
  sizeBytes: number
  mtimeMs: number
  aiTitle?: string
  lastPrompt?: string
  agentName?: string
  mode?: string
  permissionMode?: string
  firstTs?: string
  lastTs?: string
  messageCount: number
  durationMs?: number
  hasSubagents: boolean
  malformedCount: number
}

export interface ProjectInfo {
  encoded: string
  cwd: string
  sessionCount: number
  lastActivityMs?: number
  totalSizeBytes: number
  exists: boolean
}

export interface ProjectOverview {
  encoded: string
  cwd: string
  sessions: { count: number; recent: SessionSummary[] }
  usage: {
    lastCost?: number
    lastTotalInputTokens?: number
    lastTotalOutputTokens?: number
    lastDuration?: number
    lastStartTime?: string
    lastSessionId?: string
  }
  mcpServers: string[]
  skillsCount: number
  memoryCount: number
  live: { pid: number; status?: string } | null
}

export interface LiveSession {
  pid: number
  sessionId?: string
  cwd?: string
  name?: string
  status?: string
  startedAt?: number
  updatedAt?: number
  version?: string
  hasTranscript: boolean
  encoded?: string
}

export interface MessagesResponse {
  offset: number
  limit: number
  total: number
  malformedCount: number
  turns: Turn[]
  summary: Omit<SessionSummary, 'sizeBytes' | 'mtimeMs' | 'hasSubagents'>
  subagents?: SubagentInfo[]
}

export interface SubagentInfo {
  agentId: string
  agentType: string
  description: string
  toolUseId: string
  spawnDepth: number
  sizeBytes: number
}

export interface HealthResponse {
  ok: boolean
  claudeDir: string
  dotClaudeJson: string
  platform: string
  nodeVersion: string
}

export interface SearchHit {
  type: 'session' | 'memory' | 'skill' | 'plan'
  encoded?: string
  cwd?: string
  sessionId?: string
  aiTitle?: string
  slug?: string
  skillId?: string
  planFile?: string
  title: string
  label?: string
  snippet: string
  ts?: string
}

// MCP (v1.1) ---------------------------------------------------------------
export interface McpServer {
  command?: string
  args?: string[]
  env?: Record<string, string>
  type?: 'stdio' | 'sse' | 'http'
  url?: string
  [k: string]: unknown
}

export interface McpScope {
  global: Record<string, McpServer>
  projects: Array<{
    path: string
    mcpServers: Record<string, McpServer>
    allowedTools?: string[]
    mcpContextUris?: string[]
    enabledMcpjsonServers?: string[]
    disabledMcpjsonServers?: string[]
    exists?: boolean
  }>
}

// Skills (v1.2) ------------------------------------------------------------
export interface SkillSource {
  kind: 'plugin' | 'external' | 'user' | 'project'
  marketplace?: string
  plugin?: string
  project?: string
}

export interface SkillInfo {
  id: string // base64url of the skill dir relative to the Claude dir
  name: string
  description: string
  version?: string
  tools?: string[]
  source: SkillSource
  relPath: string
  hasScripts: boolean
  hasReferences: boolean
  hasAssets: boolean
}

export interface SkillDetail {
  frontmatter: Record<string, unknown>
  body: string
  raw: string
  siblings: {
    scripts: string[]
    references: string[]
    assets: string[]
  }
  relPath: string
}

// Memory (v1.2) ------------------------------------------------------------
export interface MemoryIndexEntry {
  title: string
  file: string
  summary: string
}

export interface MemoryFileInfo {
  slug: string
  name?: string
  description?: string
  type?: string
  originSessionId?: string
  title?: string
  summary?: string
  mtimeMs: number
}

export interface MemoryListResponse {
  index: MemoryIndexEntry[]
  files: MemoryFileInfo[]
  hasMemory: boolean
}

export interface MemoryDetail {
  slug: string
  raw: string
  frontmatter: Record<string, unknown>
  body: string
  mtimeMs: number
}

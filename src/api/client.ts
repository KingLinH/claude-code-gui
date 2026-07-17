import type {
  HealthResponse,
  LiveSession,
  McpScope,
  McpServer,
  MemoryDetail,
  MemoryListResponse,
  MessagesResponse,
  ProjectInfo,
  ProjectOverview,
  ProjectSettingsResponse,
  SearchHit,
  SessionSummary,
  SkillDetail,
  SkillInfo,
  SubagentInfo,
} from '@shared/types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* keep default */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface SessionDetail {
  summary: SessionSummary
  subagents: SubagentInfo[]
  live?: { pid: number; status?: string; updatedAt?: number }
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  projects: () => request<ProjectInfo[]>('/projects'),
  projectOverview: (encoded: string) =>
    request<ProjectOverview>(`/projects/${encodeURIComponent(encoded)}/overview`),
  sessions: (encoded: string) =>
    request<SessionSummary[]>(`/projects/${encodeURIComponent(encoded)}/sessions`),
  sessionDetail: (encoded: string, id: string) =>
    request<SessionDetail>(`/projects/${encodeURIComponent(encoded)}/sessions/${id}`),
  renameSession: (encoded: string, id: string, title: string) =>
    request<{ ok: boolean; summary: SessionSummary }>(
      `/projects/${encodeURIComponent(encoded)}/sessions/${id}`,
      { method: 'PATCH', body: JSON.stringify({ title }) },
    ),
  deleteSession: (encoded: string, id: string) =>
    request<{ ok: boolean; backup: string | null }>(
      `/projects/${encodeURIComponent(encoded)}/sessions/${id}`,
      { method: 'DELETE' },
    ),
  resumeSession: (encoded: string, id: string) =>
    request<{ ok: boolean; cwd: string; sessionId: string }>(
      `/projects/${encodeURIComponent(encoded)}/sessions/${id}/resume`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  newSession: (encoded: string) =>
    request<{ ok: boolean; cwd: string }>(
      `/projects/${encodeURIComponent(encoded)}/new-session`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  messages: (
    encoded: string,
    id: string,
    params: { offset?: number; limit?: number; after?: string } = {},
  ) => {
    const q = new URLSearchParams()
    if (params.offset != null) q.set('offset', String(params.offset))
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.after) q.set('after', params.after)
    const qs = q.toString()
    return request<MessagesResponse>(
      `/projects/${encodeURIComponent(encoded)}/sessions/${id}/messages${qs ? `?${qs}` : ''}`,
    )
  },
  subagentMessages: (encoded: string, id: string, agentId: string, offset = 0, limit = 1000) =>
    request<MessagesResponse>(
      `/projects/${encodeURIComponent(encoded)}/sessions/${id}/subagents/${agentId}/messages?offset=${offset}&limit=${limit}`,
    ),
  live: () => request<LiveSession[]>('/sessions/live'),
  search: (q: string, limit = 50) =>
    request<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  mcp: () => request<McpScope>('/mcp'),
  saveMcpGlobal: (mcpServers: Record<string, McpServer>) =>
    request<{ ok: boolean; backup: string | null; mtimeMs: number; count: number }>('/mcp/global', {
      method: 'PUT',
      body: JSON.stringify({ mcpServers }),
    }),
  saveMcpProject: (path: string, mcpServers: Record<string, McpServer>) =>
    request<{ ok: boolean; backup: string | null; mtimeMs: number; count: number }>('/mcp/project', {
      method: 'PUT',
      body: JSON.stringify({ path, mcpServers }),
    }),
  stats: () =>
    request<{
      projects: Array<{
        path: string
        exists: boolean
        lastCost?: number
        lastDuration?: number
        lastTotalInputTokens?: number
        lastTotalOutputTokens?: number
        lastTotalCacheReadInputTokens?: number
        lastLinesAdded?: number
        lastLinesRemoved?: number
        lastSessionId?: string
        lastStartTime?: string
      }>
      totals: {
        cost: number
        inputTokens: number
        outputTokens: number
        linesAdded: number
        linesRemoved: number
      }
    }>('/stats'),
  skills: () => request<SkillInfo[]>('/skills'),
  skillDetail: (id: string) => request<SkillDetail>(`/skills/${encodeURIComponent(id)}`),
  saveSkill: (id: string, content: string) =>
    request<{ ok: boolean; detail: SkillDetail }>(`/skills/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  createSkill: (name: string, content: string) =>
    request<{ ok: boolean; id: string }>('/skills', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    }),
  deleteSkill: (id: string) =>
    request<{ ok: boolean; backup: string | null }>(`/skills/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  memory: (encoded: string) =>
    request<MemoryListResponse>(`/memory/${encodeURIComponent(encoded)}`),
  memoryDetail: (encoded: string, slug: string) =>
    request<MemoryDetail>(`/memory/${encodeURIComponent(encoded)}/${slug}`),
  saveMemory: (encoded: string, slug: string, content: string) =>
    request<{ ok: boolean; backup: string | null; mtimeMs: number }>(
      `/memory/${encodeURIComponent(encoded)}/${slug}`,
      { method: 'PUT', body: JSON.stringify({ content }) },
    ),
  createMemory: (encoded: string, slug: string, content: string) =>
    request<{ ok: boolean; slug: string }>(`/memory/${encodeURIComponent(encoded)}`, {
      method: 'POST',
      body: JSON.stringify({ slug, content }),
    }),
  deleteMemory: (encoded: string, slug: string) =>
    request<{ ok: boolean; backup: string | null }>(
      `/memory/${encodeURIComponent(encoded)}/${slug}`,
      { method: 'DELETE' },
    ),
  settings: () =>
    request<{
      settings: Record<string, unknown>
      configHasApiKey: boolean
      apiKeyMasked?: string
      mtimeMs: number
    }>('/settings'),
  saveSettings: (settings: Record<string, unknown>) =>
    request<{ ok: boolean; backup: string | null; mtimeMs: number }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),
  projectSettings: (encoded: string) =>
    request<ProjectSettingsResponse>(`/projects/${encodeURIComponent(encoded)}/settings`),
  saveProjectSettings: (encoded: string, settings: Record<string, unknown>) =>
    request<{ ok: boolean; backup: string | null; mtimeMs: number }>(
      `/projects/${encodeURIComponent(encoded)}/settings`,
      { method: 'PUT', body: JSON.stringify({ settings }) },
    ),
  plans: () =>
    request<Array<{ file: string; title: string; sizeBytes: number; mtimeMs: number }>>('/plans'),
  planDetail: (file: string) =>
    request<{ file: string; body: string; mtimeMs: number }>(`/plans/${encodeURIComponent(file)}`),
  savePlan: (file: string, body: string) =>
    request<{ ok: boolean; backup: string | null }>(`/plans/${encodeURIComponent(file)}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    }),
}

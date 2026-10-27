import type { StageKey, StageStatus } from './utils';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function isApiConfigured(): boolean {
  return !!(import.meta.env.VITE_API_URL);
}

async function getAuthHeader(): Promise<Record<string, string>> {
  // Import lazily to avoid circular deps
  const { supabase } = await import('./supabase');
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiErrorInfo {
  statusCode?: number;
  errorCategory?: string;
  retryable?: boolean;
  retryAfter?: string;
  details?: unknown;
}

// Extend Error to carry AI error metadata the UI can act on
export class ApiError extends Error {
  statusCode?: number;
  errorCategory?: string;
  retryable?: boolean;
  retryAfter?: string;
  details?: unknown;
  constructor(message: string, info?: ApiErrorInfo) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = info?.statusCode;
    this.errorCategory = info?.errorCategory;
    this.retryable = info?.retryable;
    this.retryAfter = info?.retryAfter;
    this.details = info?.details;
  }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const authHeaders = await getAuthHeader();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options?.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new ApiError(
      body.error || `Request failed: ${response.status}`,
      {
        statusCode: response.status,
        errorCategory: body.errorCategory,
        retryable: body.retryable,
        retryAfter: body.retryAfter,
        details: body.details,
      }
    );
  }

  return response.json() as Promise<T>;
}

// ─── Projects ──────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  original_idea: string;
  idea_summary?: string;
  assumptions?: string[];
  current_stage: number;
  overall_status: 'intake' | 'in_progress' | 'complete' | 'archived';
  verdict?: 'GO' | 'PIVOT' | 'DROP' | null;
  created_at: string;
  updated_at: string;
  workflow_stages?: WorkflowStage[];
  sources?: Source[];
}

export interface WorkflowStage {
  id: string;
  project_id: string;
  stage_key: StageKey;
  status: StageStatus;
  input_data?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  approval_notes?: string;
  approved_at?: string;
  updated_at: string;
}

export interface MarketSizingEdits {
  assumptions: {
    totalPotentialCustomers: number;
    segmentPercentage: number;
    geographyNote: string;
    annualRevenuePerCustomer: number;
    reachableShare: number;
    timeHorizonYears: number;
  };
  calculations: {
    tam: number;
    sam: number;
    som: number;
    tamFormula: string;
    samFormula: string;
    somFormula: string;
  };
  scenarios: {
    low: { tam: number; sam: number; som: number };
    base: { tam: number; sam: number; som: number };
    high: { tam: number; sam: number; som: number };
  };
}

export interface Source {
  id: string;
  project_id: string;
  stage_key?: string;
  url: string;
  title: string;
  evidence_summary?: string;
  published_date?: string;
  retrieved_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CopilotConversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export const api = {
  projects: {
    list: () => apiFetch<{ projects: Project[] }>('/api/projects'),
    get: (id: string) => apiFetch<{ project: Project }>(`/api/projects/${id}`),
    create: (data: { name: string; originalIdea: string }) =>
      apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: {
      name?: string;
      ideaSummary?: string;
      assumptions?: string[];
      currentStage?: number;
      overallStatus?: Project['overall_status'];
      verdict?: 'GO' | 'PIVOT' | 'DROP' | null;
    }) =>
      apiFetch<{ project: Project }>(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  stages: {
    ideaClarification: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/idea-clarification`, {
        method: 'POST',
      }),
    confirmIdea: (projectId: string, data: { ideaSummary: string; assumptions: string[]; answers: Record<string, string> }) =>
      apiFetch<{ success: boolean }>(`/api/projects/${projectId}/stages/stage/confirm-idea`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    viability: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/viability`, {
        method: 'POST',
      }),
    targetCustomer: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/target-customer`, {
        method: 'POST',
      }),
    marketSizing: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/market-sizing`, {
        method: 'POST',
      }),
    competitors: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/competitors`, {
        method: 'POST',
      }),
    differentiation: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/differentiation`, {
        method: 'POST',
      }),
    selectStrategy: (projectId: string, strategyId: string) =>
      apiFetch<{ success: boolean; status: StageStatus }>(`/api/projects/${projectId}/stages/stage/select-strategy`, {
        method: 'POST',
        body: JSON.stringify({ strategyId }),
      }),
    gtm: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/gtm`, {
        method: 'POST',
      }),
    finalReport: (projectId: string) =>
      apiFetch<{ result: unknown }>(`/api/projects/${projectId}/stages/stage/final-report`, {
        method: 'POST',
      }),
    action: (projectId: string, data: {
      action: 'approve' | 'revise' | 'skip' | 'save';
      stageKey: StageKey;
      notes?: string;
      clarification?: { ideaSummary: string; assumptions: string[]; answers: Record<string, string> };
      marketSizing?: MarketSizingEdits;
    }) =>
      apiFetch<{ success: boolean; status: StageStatus; currentStage: number; stage: WorkflowStage }>(`/api/projects/${projectId}/stages/stage/action`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  chat: {
    listConversations: (projectId: string) =>
      apiFetch<{ conversations: CopilotConversation[]; hasMore: boolean }>(
        `/api/projects/${projectId}/chat/conversations`
      ),
    createConversation: (projectId: string) =>
      apiFetch<{ conversation: CopilotConversation }>(
        `/api/projects/${projectId}/chat/conversations`,
        { method: 'POST' }
      ),
    getConversation: (projectId: string, conversationId: string) =>
      apiFetch<{ conversation: CopilotConversation; messages: Message[] }>(
        `/api/projects/${projectId}/chat/conversations/${conversationId}`
      ),
    renameConversation: (projectId: string, conversationId: string, title: string) =>
      apiFetch<{ conversation: CopilotConversation }>(
        `/api/projects/${projectId}/chat/conversations/${conversationId}`,
        { method: 'PATCH', body: JSON.stringify({ title }) }
      ),
    deleteConversation: (projectId: string, conversationId: string) =>
      apiFetch<{ success: boolean }>(
        `/api/projects/${projectId}/chat/conversations/${conversationId}`,
        { method: 'DELETE' }
      ),
    streamMessage: async (
      projectId: string,
      conversationId: string,
      message: string,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ): Promise<void> => {
      const authHeaders = await getAuthHeader();
      const response = await fetch(`${API_URL}/api/projects/${projectId}/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ message }),
        signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Chat failed.' }));
        throw new ApiError(body.error || 'Chat request failed.', { statusCode: response.status });
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Copilot response stream is unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';
      try {
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          buffer += decoder.decode(result.value, { stream: !done });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const event of events) {
            const dataLine = event.split('\n').find(line => line.startsWith('data: '));
            if (!dataLine) continue;
            const data = dataLine.slice(6);
            if (data === '[DONE]') return;
            let parsed: { chunk?: string; error?: string };
            try {
              parsed = JSON.parse(data);
            } catch {
              throw new Error('Received an invalid Copilot response.');
            }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.chunk) onChunk(parsed.chunk);
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  },

  health: {
    ai: () => apiFetch<{
      status: string;
      provider?: string;
      primaryModel?: string;
      primaryAvailable?: boolean;
      fallbackModel?: string | null;
      fallbackAvailable?: boolean | null;
      latencyMs?: number;
      message?: string;
    }>('/api/health/ai'),
  },
};

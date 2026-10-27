import { env, features } from '../config/env';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  retrievedAt: string;
  query: string;
}

export async function search(
  query: string,
  options?: {
    maxResults?: number;
    includeAnswer?: boolean;
    searchDepth?: 'basic' | 'advanced';
  }
): Promise<SearchResponse> {
  if (!features.research) {
    throw new Error('Web research is not configured. Set TAVILY_API_KEY.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: options?.maxResults ?? 5,
      search_depth: options?.searchDepth ?? 'advanced',
      include_answer: options?.includeAnswer ?? false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Tavily search failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    results: Array<{
      title: string;
      url: string;
      content: string;
      score?: number;
      published_date?: string;
    }>;
  };

  return {
    query,
    retrievedAt: new Date().toISOString(),
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
      publishedDate: r.published_date,
    })),
  };
}

export async function searchMultiple(
  queries: string[],
  maxResultsEach = 5
): Promise<SearchResponse[]> {
  const results = await Promise.allSettled(
    queries.map((q) => search(q, { maxResults: maxResultsEach }))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SearchResponse> => r.status === 'fulfilled')
    .map((r) => r.value);
}

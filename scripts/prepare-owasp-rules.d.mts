export interface FetchLikeResponse {
      ok: boolean;
      status?: number;
      text?: () => Promise<string>;
}

export type FetchLike = (source: string, init?: { headers?: Record<string, string> }) => Promise<FetchLikeResponse>;

export declare const fetchOwaspRuleset: (
      source: string,
      fetchImpl?: FetchLike,
) => Promise<{ ruleset: string; sha256: string }>;

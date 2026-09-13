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

export interface RulesetLockInput {
      packageVersion: string;
      source: string;
      sha256: string;
      capturedAt: string;
      upstreamRevision?: string;
}

export declare const buildRulesetLock: (input: RulesetLockInput) => {
      schemaVersion: number;
      packageVersion: string;
      ruleset: string;
      source: string;
      sha256: string;
      capturedAt: string;
      upstreamRevision?: string;
};

// FinanceOS — AI Platform status shape, mirrors artifacts/api-server's
// GET /api/ai/status response. Read-only; the frontend never talks to an
// LLM directly, only to this backend status endpoint.

export type AIStatus = {
  provider: string;
  model: string;
  available: boolean;
  cacheStats: { size: number; hits: number; misses: number };
  lastRequest: string | null;
};

---
name: LLM structured output sanitization
description: Prompt-level JSON schemas drift; always sanitize LLM structured output server-side before it reaches the frontend.
---

The rule: when an LLM provider returns structured JSON for a typed frontend contract, never trust the prompt schema alone — sanitize server-side (coerce enums, drop items missing required fields, clamp numbers).

**Why:** First live Claude briefing emitted `risks` as strings (prompt said `string[]` while the frontend expected objects) and used severity `"critical"` (not in the frontend's high/medium/low vocabulary). The frontend rendered "undefined" priority cards and its severity-sort lookup broke. Fixing the prompt helped, but only server-side sanitization guarantees the contract.

**How to apply:** Any time a new LLM capability feeds a typed UI shape, add a sanitize step in the response formatter mirroring the exact frontend type (enum coercion, required-field filtering, numeric clamping). Also instruct the model to never emit the literal words null/NaN/undefined — context JSON often contains nulls it will otherwise echo (e.g. "$null").

## Related: a single global max_tokens cap can silently truncate structured JSON

When adding an env-configurable `AI_MAX_TOKENS` cost control, do NOT apply it as a blanket `Math.min(perCapabilityDefault, envCap)` across every capability. A capability that returns large structured JSON (e.g. a multi-section briefing) may need ~3x the tokens of a plain-text capability (e.g. a one-line answer). Capping the JSON-producing capability at the same env default truncated the JSON mid-object, and the response silently degraded into garbled/partial content rather than erroring loudly.

**Why:** cost-control env vars are usually written with the cheapest/smallest capability in mind; applying them uniformly breaks the capability with the largest structured payload.

**How to apply:** keep each capability's own hand-tuned max_tokens as the source of truth; only apply a global env cap if it's capability-aware (e.g. a per-capability map, or a cap high enough that even the largest structured response fits). If unsure, surface the env value in status/usage endpoints without wiring it into request truncation yet.

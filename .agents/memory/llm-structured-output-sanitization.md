---
name: LLM structured output sanitization
description: Prompt-level JSON schemas drift; always sanitize LLM structured output server-side before it reaches the frontend.
---

The rule: when an LLM provider returns structured JSON for a typed frontend contract, never trust the prompt schema alone — sanitize server-side (coerce enums, drop items missing required fields, clamp numbers).

**Why:** First live Claude briefing emitted `risks` as strings (prompt said `string[]` while the frontend expected objects) and used severity `"critical"` (not in the frontend's high/medium/low vocabulary). The frontend rendered "undefined" priority cards and its severity-sort lookup broke. Fixing the prompt helped, but only server-side sanitization guarantees the contract.

**How to apply:** Any time a new LLM capability feeds a typed UI shape, add a sanitize step in the response formatter mirroring the exact frontend type (enum coercion, required-field filtering, numeric clamping). Also instruct the model to never emit the literal words null/NaN/undefined — context JSON often contains nulls it will otherwise echo (e.g. "$null").

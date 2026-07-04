---
name: express-rate-limit IPv6 keyGenerator requirement
description: express-rate-limit v8+ throws a startup ValidationError if a custom keyGenerator returns req.ip directly instead of using the ipKeyGenerator helper.
---

express-rate-limit v8+ validates custom `keyGenerator` functions at rate-limiter construction time. A naive `keyGenerator: (req) => req.ip ?? "unknown"` throws `ERR_ERL_KEY_GEN_IPV6` because raw IPv6 addresses can be used to bypass per-IP limits (different textual representations of the same address).

**Why:** the library added this validation to prevent silent rate-limit bypass; it fails loudly (throws) rather than warning, which can look like an unrelated startup crash if you don't recognize the error name.

**How to apply:** import `ipKeyGenerator` from `express-rate-limit` and wrap the IP: `keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown")`. Apply this to any rate limiter keyed on request IP.

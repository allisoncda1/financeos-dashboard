---
name: FinanceOS Resend email
description: Resend secret naming and sending constraints for FinanceOS transactional email
---
- The Resend API key lives in the secret named `Resend` (not `RESEND_API_KEY`); email code falls back across both names.
- **Why:** the user saved the key under `Resend` when requested; renaming secrets isn't in agent control.
- Until a domain is verified in the user's Resend dashboard, the default sender `onboarding@resend.dev` can only deliver to the Resend account owner's email; other recipients get a 422. Set `RESEND_FROM_EMAIL` once a domain is verified.
- **How to apply:** any new email feature should reuse `artifacts/api-server/src/lib/email.ts` and surface Resend 422s in logs, never to the caller of enumeration-sensitive endpoints.

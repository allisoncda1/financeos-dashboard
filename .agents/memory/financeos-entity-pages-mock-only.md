---
name: FinanceOS entity pages ignore live data
description: FinanceOS entity detail pages (financials/customers/vendors/banking) call live-fetch hooks but discard the result, rendering mock data only.
---

In the FinanceOS frontend, `src/pages/entity/{financials,customers,vendors,banking}.tsx` each import their corresponding live-data hook (`useEntityFinancials`, `useEntityCustomers`, `useEntityVendors`, `useEntityBanking` from `src/hooks/useApi.ts`) but never use the hook's returned value. Instead they call the mock-data getter (`getFinancials(eSlug)`, etc. from `src/lib/mock.ts`) directly and render that.

**Why:** The hooks do fire and successfully fetch data from the backend (confirmed via server request logs during Sprint 12 backend verification), but the fetched result is discarded — so any backend/API correctness work is invisible in the UI until this is fixed. This looks like leftover scaffolding from an incomplete live-data wiring pass, not intentional behavior. As of 2026-07-03 the user was asked and explicitly declined to have this fixed as part of a backend-only sprint, so it remains open.

**How to apply:** Before assuming "the backend is returning wrong/stale data" when a FinanceOS entity page shows unexpected numbers, check whether the page is actually consuming the hook's data or still calling the mock getter — verify via server access logs (does a request actually hit the endpoint?) rather than trusting what's rendered. When permitted to touch the frontend, the fix is to replace the `getXxx(eSlug)` call with the value returned by the corresponding `useEntityXxx(eSlug)` hook in each of the four page files.

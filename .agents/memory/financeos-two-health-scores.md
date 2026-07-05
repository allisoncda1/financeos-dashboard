---
name: FinanceOS two health scores
description: Why the entity dashboard has two different "health" numbers that intentionally disagree.
---
The entity dashboard shows a **Company Health Score** (overall financial health, 0–100, with a category breakdown) computed by `lib/healthScore.ts#computeCompanyHealth`. This is separate from and intentionally different from the compact **health badge** produced by `lib/briefing.ts#computeHealthScore`, which powers the portfolio grid, sidebar, and entity summary cards.

**Why:** They answer different questions and use different methods. `briefing.ts` is a penalty-based compact score (DSO/AR/AP/net-margin) meant as a small at-a-glance badge across many entities. The dashboard score is a weighted average of 7 named categories (profitability, gross margin, liquidity, cash position, AR/AP quality, revenue growth, validation) with graceful exclusion + weight re-normalization when inputs are missing. The user accepted that the two numbers can differ.

**How to apply:** Do not "reconcile" the two or make one call the other. Changing financial calc outside the new Company Health component was explicitly out of scope. If asked why the dashboard number differs from the card badge, explain the two-source design rather than treating it as a bug.

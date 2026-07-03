# FinanceOS Dashboard

Presentation layer for the FinanceOS portfolio intelligence system.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4  
**Host:** Replit / GitHub  
**Status:** Phase 1 — skeleton with mock data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FinanceOS (qbo_extract)  →  Google Shared Drive  →  This app   │
│                                                                 │
│  QBO extraction               08_DATA_MODEL          Next.js    │
│  40/40 validation             09_MODEL_HISTORY       Replit     │
│  Excel reports                                       Phase 1→3  │
│  (financial engine —          (source of truth —    (read-only  │
│   never touched here)          never here)           display)   │
└─────────────────────────────────────────────────────────────────┘
```

### Security boundaries

| Rule | Detail |
|---|---|
| No QBO access | This app never connects to QuickBooks |
| No bank APIs | No Plaid, no Stripe, no banking SDKs |
| No secrets in frontend | Credentials exist only as env vars in API routes (server-side) |
| No real data in repo | `data/mock/` contains invented numbers only |
| Read-only Drive | Service account has Drive read-only scope — no writes |
| Google Shared Drive only | `GOOGLE_SHARED_DRIVE_ID` required; no personal Drive fallback |

---

## Data sources

| Phase | Source | Status |
|---|---|---|
| Phase 1 (current) | `data/mock/` — invented numbers | ✅ Running |
| Phase 2 | Google Shared Drive → `/api/model` API route | Not yet wired |
| Phase 3 | `09_MODEL_HISTORY` — period comparisons + trends | Not yet wired |

### Drive path (Phase 2)

```
Google Shared Drive / FinanceOS /
├── 08_DATA_MODEL/               ← latest dashboard data (read here)
│   ├── entities/
│   │   ├── CarDealer_ai/
│   │   │   ├── metrics.json
│   │   │   └── anomalies.json
│   │   ├── T3_Marketing/
│   │   ├── TopMrktr/
│   │   └── Smile_More/
│   ├── portfolio/summary.json
│   ├── validation/validation_summary.json
│   └── audit/data_freshness.json
└── 09_MODEL_HISTORY/            ← historical archives (Phase 3)
    ├── daily/YYYY-MM-DD/
    ├── weekly/YYYY-WXX/
    ├── month_end/YYYY-MM/
    ├── quarter_end/YYYY-QX/
    └── year_end/YYYY/
```

---

## Mock data structure

`data/mock/` mirrors `08_DATA_MODEL` exactly so the Phase 2 swap is seamless — only `lib/mock.ts` changes, zero component changes.

See [data/mock/README.md](data/mock/README.md) for rules about what must never be committed here.

---

## Phase 2: Swapping to real Drive data

When ready, the swap is **three steps**:

**1. Create `/app/api/model/route.ts`** (server-side only):
```ts
import { google } from "googleapis";

export async function GET() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });
  // ... read from GOOGLE_SHARED_DRIVE_ID / FinanceOS / 08_DATA_MODEL
  return Response.json(data);
}
```

**2. Add to `lib/mock.ts`**:
```ts
export async function getDriveData(): Promise<DashboardData> {
  const res = await fetch("/api/model", { next: { revalidate: 3600 } });
  return res.json();
}
```

**3. Update pages** (`app/page.tsx`, `app/entity/[slug]/page.tsx`):
```ts
// Before: const data = getMockData();
// After:
const data = await getDriveData();
```

No component files change. Types are identical because mock data mirrors the Drive schema.

---

## Environment variables

Copy `.env.local.example` to `.env.local`. Set as Replit Secrets — never commit.

| Variable | Used in | Phase |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | All | 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `/api/model` (server only) | 2 |
| `GOOGLE_SHARED_DRIVE_ID` | `/api/model` (server only) | 2 |

---

## Development

```bash
npm install
npm run dev     # http://localhost:3000
```

No credentials needed for Phase 1 — all data is from `data/mock/`.

---

## Entities

| Slug | Display Name | Accounting Basis |
|---|---|---|
| `CarDealer_ai` | CarDealer.ai | Accrual |
| `T3_Marketing` | T3 Marketing | Cash |
| `TopMrktr` | TopMrktr | Accrual |
| `Smile_More` | Smile More | Accrual |

Slugs match `08_DATA_MODEL/entities/` folder names exactly.

---

## Project structure

```
financeos-dashboard/
├── app/
│   ├── layout.tsx                    Root layout (sidebar + main)
│   ├── page.tsx                      Portfolio overview
│   ├── entity/[slug]/page.tsx        Per-entity detail
│   └── api/                          Server-side routes (Phase 2)
├── components/
│   ├── layout/Sidebar.tsx            Entity navigation
│   ├── layout/TopBar.tsx             Page header + badge
│   ├── portfolio/PortfolioKpis.tsx   4-entity summary grid
│   ├── portfolio/ValidationBadge.tsx 40/40 validation indicator
│   ├── entity/MetricsRow.tsx         DSO, DPO, AR, AP, margins
│   └── entity/AnomalyList.tsx        Rule violation alerts
├── lib/
│   ├── types.ts                      TypeScript types (mirrors 08_DATA_MODEL schemas)
│   └── mock.ts                       Mock data loader (Phase 1) → swap to Drive (Phase 2)
├── data/mock/                        Invented data — UI dev only, never real financials
└── .env.local.example                Environment variable template
```

---

*FinanceOS Dashboard — Layer 3 Presentation*  
*Read-only. No financial logic. No QBO access. No bank APIs.*  
*Source of truth: Google Shared Drive / FinanceOS / 08_DATA_MODEL*

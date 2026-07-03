# Mock Data — UI Development Only

> ⚠️ **This directory contains INVENTED data. It is not real financial data.**

## Rules

1. Numbers are fake. They do not represent any real company's finances.
2. This data exists only so the UI can be developed without a Drive connection.
3. **NEVER commit real financial data to this repo.** Not here, not anywhere.
4. In production, all data comes from Google Shared Drive — see Phase 2 in README.md.

## Folder structure mirrors `08_DATA_MODEL` exactly

```
data/mock/
├── entities/
│   ├── CarDealer_ai/
│   │   ├── metrics.json        ← matches 08_DATA_MODEL/entities/CarDealer_ai/metrics.json
│   │   └── anomalies.json      ← matches 08_DATA_MODEL/entities/CarDealer_ai/anomalies.json
│   ├── T3_Marketing/
│   ├── TopMrktr/
│   └── Smile_More/
├── portfolio/
│   └── summary.json            ← matches 08_DATA_MODEL/portfolio/summary.json
├── validation/
│   └── validation_summary.json ← matches 08_DATA_MODEL/validation/validation_summary.json
└── audit/
    └── data_freshness.json     ← matches 08_DATA_MODEL/audit/data_freshness.json
```

This mirroring means the Phase 2 Drive swap requires zero type changes — the shapes are identical.

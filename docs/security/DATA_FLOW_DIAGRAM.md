> **DRAFT — NOT YET APPROVED.** Effective date: [PENDING APPROVAL]

# FinanceOS Security Data Flow Diagram
**Version:** 0.1-draft  
**Date:** 2026-07-21

This diagram shows all data flows, authentication boundaries, encryption points, and storage for FinanceOS, including the planned Plaid integration.

No real credentials, tokens, or connection strings appear in this document.

---

## System Data Flow (Mermaid)

```mermaid
flowchart TD
    subgraph Human["👤 Human Access (Allison)"]
        A[Browser]
    end

    subgraph Dashboard["FinanceOS Dashboard — Replit"]
        B[Express API Server<br/>Session Auth + RBAC]
        B_MFA[TOTP MFA Layer<br/>🔒 Planned]
    end

    subgraph CorePipeline["FinanceOS Core — GitHub Actions"]
        C[Python QBO Sync<br/>validate_sync_ar_ap.py]
    end

    subgraph ExternalAPIs["External APIs"]
        QBO[QuickBooks Online API<br/>HTTPS / TLS 1.2+]
        PLAID_LINK[Plaid Link<br/>🔒 Planned]
    end

    subgraph Secrets["Secret Storage"]
        RS[Replit Secrets<br/>🔒 Encrypted at rest<br/>Admin password, DB URLs]
        GH_SEC[GitHub Encrypted Secrets<br/>🔒 libsodium sealed<br/>QBO credentials, GCP WIF]
        GCP_SM[GCP Secret Manager<br/>🔒 Google-managed keys<br/>QBO refresh tokens]
    end

    subgraph Database["Neon PostgreSQL — Encrypted at rest"]
        DB_CORE[(Core Financial DB<br/>invoices, bills,<br/>qbo_raw, sync_runs)]
        DB_OPS[(Dashboard Ops DB<br/>sessions, user_mfa,<br/>plaid_consent — planned)]
    end

    subgraph CI["GitHub Actions CI"]
        GH_ACTIONS[GitHub Actions Runner]
    end

    subgraph GCP["Google Cloud Platform"]
        WIF[Workload Identity Federation<br/>OIDC — no stored key]
    end

    %% Human to Dashboard
    A -->|"HTTPS + Session Cookie<br/>httpOnly, secure, sameSite:lax"| B
    B --> B_MFA

    %% Dashboard reads Core DB (read-only role)
    B -->|"TLS — financeos_dashboard role<br/>SELECT only"| DB_CORE

    %% Dashboard writes to Ops DB
    B -->|"TLS — full privileges<br/>Sessions, MFA, consent"| DB_OPS

    %% Dashboard secrets
    RS -->|"Injected at startup<br/>via Replit env"| B

    %% Pipeline auth via WIF
    GH_ACTIONS -->|"OIDC token"| WIF
    WIF -->|"Short-lived credential"| GCP_SM
    GCP_SM -->|"QBO refresh token<br/>(never logged)"| C

    %% Pipeline reads from QBO
    C -->|"HTTPS / TLS 1.2+<br/>OAuth2 Bearer"| QBO
    QBO -->|"Financial records"| C

    %% Pipeline writes to Core DB
    C -->|"TLS — postgres role<br/>INSERT/UPDATE"| DB_CORE

    %% CI secrets
    GH_SEC -->|"Encrypted injection<br/>at job runtime"| GH_ACTIONS

    %% Future Plaid
    A -->|"Plaid Link SDK<br/>HTTPS — Planned"| PLAID_LINK
    PLAID_LINK -->|"Access token<br/>via backend — Planned"| B
    B -->|"Encrypted token stored<br/>AES-256-GCM — Planned"| DB_OPS
```

---

## Control Legend

| Symbol | Meaning |
|---|---|
| 🔒 | Encrypted channel or encrypted storage |
| 🔒 Planned | Control exists in code but not yet deployed |
| HTTPS / TLS 1.2+ | Transport encryption verified |
| OIDC | Short-lived token — no stored long-term credential |
| httpOnly, secure | Cookie flags preventing JS access and HTTP transmission |

---

## Authentication Boundaries

| Boundary | Auth Type | MFA Required | Notes |
|---|---|---|---|
| Browser → Dashboard | Session cookie (bcrypt password) | Planned (TOTP) | MFA gate being deployed |
| GitHub Actions → GCP | OIDC (Workload Identity Federation) | N/A — machine auth | No stored service account key |
| Core Pipeline → QBO | OAuth2 refresh token | N/A — machine auth | Tokens in GCP Secret Manager |
| Future: Browser → Plaid Link | Plaid Link SDK (bank credential handled by Plaid) | Gated by FinanceOS MFA | Consent required before surfacing |
| Dashboard → Neon (Core DB) | Connection string + read-only role | N/A — machine auth | financeos_dashboard role |
| Dashboard → Neon (Ops DB) | Connection string + full role | N/A — machine auth | Sessions and ops data only |

---

## Data Classification

| Data Type | Location | Sensitivity | Access |
|---|---|---|---|
| QBO financial records (invoices, bills, payments) | Neon Core DB | High | Core pipeline write; Dashboard read-only |
| QBO aging reports (AR/AP) | Neon Core DB (qbo_raw) | High | Core pipeline write; Dashboard read-only |
| Entity snapshots | Neon Core DB | Medium | Core pipeline write; Dashboard read-only |
| Session data (email, role, name) | Neon Ops DB | Medium | Dashboard read/write |
| TOTP secrets (encrypted) | Neon Ops DB (planned) | Critical | Backend only; never logged or returned to client |
| Recovery code hashes | Neon Ops DB (planned) | High | Backend only; show plaintext codes once at enrollment |
| Plaid access tokens (encrypted) | Neon Ops DB (planned) | Critical | Backend only; never logged or returned to client |
| Consent records | Neon Ops DB (planned) | Medium | Backend; Allison can view |
| QBO refresh tokens | GCP Secret Manager | Critical | Automated pipeline only; never logged |
| Admin password (bcrypt hash) | Replit Secrets | Critical | Server startup only; never logged or returned |

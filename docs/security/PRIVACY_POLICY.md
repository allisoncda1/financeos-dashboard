> **APPROVED.** Effective date: 2026-07-22. The `/privacy` route is implemented and publicly accessible at the Replit deployment URL. A stable production URL is required before final Plaid questionnaire submission.

# FinanceOS Privacy Policy

**Version:** 1.0<br>
**Owner and privacy contact:** Allison Fabbri, Controller & FinanceOS Project Lead (allison@cardealer.ai)<br>
**Last Updated:** 2026-07-22<br>
**Review Frequency:** At least annually and whenever FinanceOS materially changes its data practices

---

## 1. Scope and Purpose

FinanceOS is a private, internal financial operations and reporting platform used only by authorized personnel working for CarDealer.ai and its affiliated companies: T3 Marketing, CarDealer.ai, TopMrktr, and Smile More. It is not sold or offered to external clients, does not provide external customer accounts, and is not available to the general public.

This policy explains what information FinanceOS processes, why it is processed, where it is stored, how it is protected, and how requests concerning that information are handled.

## 2. Information FinanceOS Processes

### 2.1 Business Financial and Accounting Information

FinanceOS imports and derives business records from QuickBooks Online, including:

- chart of accounts and general-ledger information;
- invoices, bills, payments, credits, customers, and vendors;
- accounts-receivable and accounts-payable information;
- balance-sheet, profit-and-loss, and cash-flow information; and
- reporting, validation, reconciliation, and historical snapshots.

These records may include personal information when a customer, vendor, employee, or business contact is identifiable. FinanceOS treats that information as protected data even when it appears in a business record.

### 2.2 Authorized User and Security Information

FinanceOS processes the minimum information needed to authenticate and authorize approved employees or contractors acting on behalf of the group, including:

- name, business email address, and assigned role;
- password hashes where password authentication is used;
- encrypted multi-factor-authentication enrollment data and recovery-code hashes;
- session identifiers and expiration data; and
- security, consent, and audit events.

Plaintext passwords, authenticator secrets, and recovery codes are not intentionally stored in application logs or source control.

### 2.3 Operational and Audit Information

FinanceOS records synchronization runs, validation outcomes, report history, access events, and error information needed to operate, secure, and audit the platform.

### 2.4 Planned Plaid Information

Plaid is not yet active in production. When enabled, Plaid Link will be presented only to an authorized internal representative connecting a business bank account belonging to one of the managed group companies. FinanceOS will not offer Plaid connectivity to external customers or invite individuals to connect personal accounts. It will collect only the business bank-account and transaction information necessary for approved accounting, reconciliation, and reporting purposes. The production integration must not store Plaid credentials in source code or browser storage.

## 3. Purposes of Processing

FinanceOS processes information only for legitimate internal business purposes, including:

- accounting, reconciliation, and financial reporting;
- cash, receivables, payables, and transaction monitoring;
- validation, audit trails, and issue investigation;
- user authentication, authorization, and platform security; and
- legal, tax, regulatory, and contractual recordkeeping.

FinanceOS does not sell personal information or use financial information for advertising.

## 4. Data Sources and Consent

Information is obtained from authorized group-company systems and authorized internal users. QuickBooks Online access uses OAuth authorization. Before any Plaid connection is created, the authorized company representative must receive a clear disclosure, confirm authority to connect the applicable business account, and provide affirmative consent through the FinanceOS/Plaid Link flow. FinanceOS records the applicable policy version and consent event.

## 5. Storage, Security, and Access

Financial data is stored in the FinanceOS Core PostgreSQL database. Application security, session, consent, and other Dashboard-owned operational records are stored in the FinanceOS operational PostgreSQL database.

Controls include:

- TLS for data in transit;
- provider-managed encryption at rest;
- role-based access controls and least-privilege access;
- multi-factor authentication for FinanceOS and critical administrative platforms;
- encrypted storage for application-managed TOTP secrets; and
- restricted secrets management outside source control.

Access is limited to authorized personnel with a business need.

## 6. Service Providers

FinanceOS uses service providers to operate the platform. Depending on the feature, they may include:

| Provider | Purpose |
|---|---|
| Neon | PostgreSQL database hosting |
| Replit | Development and application hosting |
| Google | Business identity, OAuth, and approved integrations |
| Intuit / QuickBooks Online | Accounting system and source records |
| GitHub | Source control, change review, and automation |
| Anthropic | AI-assisted features when explicitly used |
| Plaid | Planned bank connectivity; not yet active in production |

FinanceOS shares only the information reasonably necessary for the relevant service and configuration. GitHub is not intended to receive production financial records or secrets.

## 7. Data Retention

Information is retained only while needed for an approved business, legal, security, or audit purpose. Specific periods and deletion procedures are defined in the FinanceOS Data Retention and Deletion Policy. Retention periods vary by record type; seven years is a conservative internal period for core accounting books and supporting records, not a universal legal rule for every category.

## 8. Access, Correction, and Deletion Requests

Authorized users or affected individuals may request access, correction, restriction, or deletion by contacting:

**Allison Fabbri — allison@cardealer.ai**

FinanceOS verifies the requester and evaluates each request against applicable accounting, tax, contractual, security, and legal-hold requirements. If deletion cannot be completed, the requester will be informed of the applicable reason when appropriate.

## 9. Security Incidents

Suspected unauthorized access, disclosure, alteration, or loss of FinanceOS information must be reported immediately to the security contact above and handled under the FinanceOS Incident Response Plan.

## 10. Policy Changes

Material changes are versioned, reviewed, approved, and communicated to authorized internal users. Plaid will not be enabled in production until this policy is approved, published at a public URL for transparency and Plaid diligence, linked from the application, and updated to reflect the implemented Plaid data flow. Publishing the policy does not make FinanceOS publicly accessible.

## 11. Approval

**Approver:** Allison Fabbri<br>
**Approval date:** 2026-07-22<br>
**Public URL (dev/current):** `https://f2131a9f-1943-4611-9f2c-efe4f28a76cb-00-2l4nfeksnyk44.kirk.replit.dev/privacy`<br>
**Stable public URL:** Pending Replit deployment — will be `https://<stable-deployment-url>/privacy`. Required before final Plaid submission.

---

*This document describes current controls and clearly identifies planned controls. It is not legal advice; retention and privacy requirements must be confirmed for each applicable entity and jurisdiction.*

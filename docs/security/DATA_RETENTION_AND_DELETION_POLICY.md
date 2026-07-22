> **DRAFT — REVIEWED FOR ACCURACY, PENDING FORMAL APPROVAL.** Effective date: [PENDING APPROVAL]

# FinanceOS Data Retention and Deletion Policy

**Version:** 0.9-review<br>
**Owner:** Allison Fabbri, Controller & FinanceOS Project Lead (allison@cardealer.ai)<br>
**Last Updated:** 2026-07-22<br>
**Review Frequency:** At least annually and whenever legal requirements or data practices materially change

---

## 1. Purpose

This policy establishes defined retention periods, deletion procedures, responsibilities, and exceptions for information processed by FinanceOS, a private internal platform for CarDealer.ai and its affiliated companies. FinanceOS has no external client accounts or public user access. Its objectives are to preserve records needed for group-company accounting and audit while removing sensitive information when there is no longer a legitimate need to retain it.

## 2. Systems and Data Categories

| Data Category | Primary Location | Examples |
|---|---|---|
| Core accounting records | FinanceOS Core PostgreSQL | invoices, bills, payments, credits, accounts, transactions |
| Source and derived financial records | FinanceOS Core PostgreSQL | authorized source payloads, financial periods, entity snapshots, cash-flow statements |
| Pipeline and validation records | FinanceOS Core PostgreSQL | sync runs, validation results, reconciliation evidence |
| Application security records | FinanceOS operational PostgreSQL | sessions, MFA enrollment metadata, encrypted TOTP secrets, consent and deletion requests |
| Reporting operations | FinanceOS operational PostgreSQL / approved object storage | report drafts, history, approval metadata, generated artifacts |
| Source control and automation | GitHub | application code and CI logs; no intentional production secrets or financial datasets |

## 3. Approved Retention Schedule

| Category | Standard Period | Rationale / Trigger |
|---|---:|---|
| Core accounting books and supporting transaction records | 7 years after the relevant fiscal year closes | Conservative internal accounting and audit period; extend or shorten only after entity-specific legal/tax review |
| Property, fixed-asset, basis, and depreciation records | Life of the asset plus the applicable limitation period | Needed to establish basis and disposition calculations |
| Employment-tax records, when stored | At least 4 years after the tax becomes due or is paid, whichever is later | IRS employment-tax recordkeeping guidance; longer where another rule applies |
| Raw source payloads used as accounting evidence | Up to 7 years, with annual necessity review | Supports reproducibility and audit; remove earlier when no longer needed and no hold applies |
| Pipeline, validation, and reconciliation logs | 2 years | Operational and security audit trail |
| Security and administrative audit events | 2 years | Incident investigation and access review |
| User account and role record | Active use plus 1 year | Access and approval audit trail |
| Encrypted MFA secret | Active enrollment only | Delete promptly when MFA is reset or the account is deactivated |
| Active session | 8 hours maximum under normal configuration | Automatic session expiration; invalidate immediately on logout, reset, or deactivation where supported |
| Consent and policy-acceptance records | 7 years after consent withdrawal or relationship end | Evidence of authorization and policy version |
| Generated reports and report approvals | 7 years when part of the accounting record; otherwise 2 years | Accounting evidence versus operational working files |
| Plaid access token | Active connection only | Revoke and delete promptly when the connection is removed or authorization is withdrawn |
| Plaid-derived business bank transactions | Same period as the corresponding accounting record | Limited to managed group-company accounts; subject to legal hold and entity-specific accounting requirements |

The IRS does not prescribe one universal period for every business record. The default seven-year FinanceOS period is a conservative business policy. The owner must obtain entity-specific legal or tax advice where a different rule may apply.

## 4. Data Minimization and Annual Review

At least annually, the owner reviews stored categories to confirm that:

1. the information remains necessary for an identified purpose;
2. access remains limited to authorized users;
3. records past their retention period are eligible for deletion; and
4. no legal hold, open audit, dispute, or contractual requirement prevents deletion.

FinanceOS must not retain Plaid credentials, bank data, or personal information merely because storage is available.

## 5. Deletion Requests

Requests may be submitted to **allison@cardealer.ai**. The owner must:

1. record the request and date received;
2. verify the requester's identity and authority;
3. identify the relevant systems and records;
4. determine whether a legal, tax, accounting, contractual, or security obligation requires retention;
5. delete, anonymize, restrict, or retain the records as appropriate; and
6. record the outcome without reproducing the deleted sensitive information.

Requests should be completed without undue delay, with an internal target of 30 days unless verification, legal hold, technical complexity, or applicable law requires additional time.

## 6. Current Enforcement Procedure

Automated retention jobs and the in-application deletion workflow are not yet complete. Until they are implemented and verified, this policy is enforced through a controlled manual procedure:

1. an authorized operator prepares a narrowly scoped record-selection query;
2. the affected record count and retention basis are reviewed;
3. the operator confirms that no legal hold applies;
4. deletion or anonymization is performed using MFA-protected administrative access and least-privilege credentials;
5. related sessions, tokens, cached artifacts, and object-storage files are removed where applicable;
6. the result is verified; and
7. a deletion event is recorded in the security evidence register.

Manual deletion must not be performed from application read-only credentials or by editing source data in the user interface. Database backups and provider snapshots expire according to provider configuration and are not restored solely to recover deliberately deleted records unless legally required.

## 7. Account Deactivation and MFA Reset

When an internal user is deactivated:

1. disable authentication and authorization;
2. invalidate active sessions;
3. delete the encrypted MFA secret and unused recovery credentials;
4. retain only the minimum account and approval metadata required for the one-year audit period; and
5. delete the remaining account record after that period unless a hold applies.

## 8. Plaid Connection Removal

Plaid is not yet active in production and will be used only by authorized internal representatives for managed group-company bank accounts. Before production launch, FinanceOS must implement and test a process that:

1. calls Plaid's item-removal mechanism to revoke the connection;
2. deletes the encrypted access token from FinanceOS;
3. prevents further synchronization;
4. handles derived bank transactions according to the accounting-record schedule and any valid deletion request; and
5. records a non-sensitive revocation event.

The Plaid questionnaire must not claim that this automated process is operational until the production implementation has been verified.

## 9. Legal Hold

Deletion is suspended for records reasonably related to litigation, an audit, a regulatory investigation, a preservation request, or another documented legal obligation. The hold record must identify its scope, authority, start date, and release approval without unnecessarily copying the protected data.

## 10. Exceptions and Evidence

Exceptions require written approval from the policy owner and must state the data scope, reason, duration, and compensating control. Evidence of deletion and approved exceptions is retained for seven years, without storing plaintext credentials, tokens, or the deleted content itself.

## 11. Approval

**Approver:** Allison Fabbri<br>
**Approval date:** [PENDING APPROVAL]

---

*This policy is a documented operational control, not legal advice. Applicable requirements must be confirmed for each FinanceOS entity and jurisdiction.*

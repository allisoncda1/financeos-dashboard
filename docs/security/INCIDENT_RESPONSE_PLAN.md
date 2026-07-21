> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Incident Response Plan

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually, or after any security incident  

---

## 1. Purpose

This plan defines how FinanceOS detects, contains, investigates, and recovers from security incidents. Because FinanceOS has a single operator, this is an internal plan — there is no separate security operations team.

## 2. Incident Categories

| Category | Description | Examples |
|---|---|---|
| **Credential Exposure** | A credential (password, API key, token) is exposed or potentially compromised | Secret committed to git, phishing attempt, suspicious login |
| **Unauthorized Access** | Evidence of access to FinanceOS systems by an unintended party | Unexpected session, unknown IP in logs, anomalous API calls |
| **Data Breach** | Financial data belonging to the four entities is accessed or exfiltrated without authorization | Database access from unknown role, QBO data leak |
| **Dependency Vulnerability** | A Critical or High CVE is identified in a FinanceOS dependency | Published CVE with active exploit for a package in use |
| **Platform Incident** | A vendor (Replit, Neon, GCP, Intuit, GitHub) reports a security event affecting FinanceOS | Vendor breach notification, TLS failure |

## 3. Detection

FinanceOS does not currently have automated alerting infrastructure. Detection occurs through:

- **Replit application logs:** Unusual error rates, failed login spikes, unexpected traffic patterns
- **GitHub Dependabot / Secret scanning alerts:** Exposed secrets, vulnerable dependencies
- **Neon console monitoring:** Unusual query volume or connection attempts
- **GCP Security notifications:** Workload Identity or Secret Manager access anomalies
- **Vendor breach notifications:** Email notifications from Replit, Neon, Intuit, GitHub, or Google
- **Manual review:** Routine log inspection during operations

> **Limitation:** Real-time alerting is not yet configured. This is a known gap. Automated monitoring is on the FinanceOS roadmap.

## 4. Incident Severity

| Level | Definition |
|---|---|
| **P1 — Critical** | Active unauthorized access or data exfiltration in progress; credential exposure with confirmed unauthorized use |
| **P2 — High** | Credential exposure with unconfirmed use; Critical CVE with active exploit in FinanceOS stack |
| **P3 — Medium** | Suspected compromise with no confirmed access; High CVE identified |
| **P4 — Low** | No immediate threat; informational alerts, minor anomalies |

## 5. Response Procedures

### 5.1 Credential Exposure (P1/P2)

1. **Rotate immediately:** Revoke or rotate the exposed credential before any other action.
   - Admin password: change in Replit Secrets and update bcrypt hash.
   - QBO refresh token: revoke via Intuit OAuth dashboard, re-authorize.
   - Database URL: rotate Neon credentials, update Replit Secrets and GitHub Encrypted Secrets.
2. **Assess scope:** Determine what systems the credential could access and what actions were possible.
3. **Review access logs:** Check Replit logs, Neon connection logs, GCP audit logs for unauthorized use in the prior 30 days.
4. **Contain further access:** If unauthorized access is confirmed, proceed to Section 5.2.
5. **Document:** Record the incident (what was exposed, when discovered, what was rotated, what was found in logs).

### 5.2 Unauthorized Access (P1)

1. **Terminate active sessions:** Invalidate all application sessions.
2. **Rotate all credentials:** Treat all secrets as potentially compromised — rotate admin password, QBO tokens, database URLs.
3. **Take FinanceOS offline if necessary:** Use Replit controls to stop the repl if active intrusion is suspected.
4. **Preserve evidence:** Export relevant logs before rotating credentials or restarting services (Replit logs, Neon query logs, GCP audit logs).
5. **Assess damage:** Determine what data was accessed, for which entities, and over what time period.
6. **Recovery:** Restore from a known-good state if data integrity is in question. Verify database records against QBO source of truth.
7. **Post-incident review:** Complete within 5 business days (see Section 7).

### 5.3 Data Breach (P1)

1. Follow Section 5.2 for containment and evidence preservation.
2. Assess which entities' data was affected (T3 Marketing, CarDealer.ai, TopMrktr, Smile More).
3. Determine if any external parties (vendors, customers named in financial records) have been affected.
4. If the breach involves data regulated under applicable law, consult legal counsel regarding notification obligations.
5. Document all findings for the post-incident record.

### 5.4 Dependency Vulnerability (P2/P3)

1. Apply the SLA from `docs/security/VULNERABILITY_AND_PATCH_MANAGEMENT_POLICY.md`.
2. For Critical vulnerabilities with active exploits: take affected functionality offline until patched if possible.
3. Update the dependency, test, and deploy per the patch process.

### 5.5 Platform Incident (vendor-initiated)

1. Read the vendor's incident report or notification.
2. Assess whether FinanceOS data or access was in scope.
3. Rotate any credentials that the vendor indicates may have been affected.
4. Follow vendor remediation guidance.
5. Document the event and vendor response.

## 6. Evidence Preservation

Before rotating credentials or making significant changes:
- Export Replit application logs for the relevant time window.
- Export Neon query logs from the console.
- Download GCP Audit Logs for Secret Manager access.
- Save a copy of GitHub Actions workflow logs.

Store evidence in a secure location (local encrypted storage) during investigation. Do not delete logs until the post-incident review is complete.

## 7. Post-Incident Review

For all P1 and P2 incidents, a post-incident review must be completed within **5 business days** of containment. The review must document:

1. Timeline: When the incident started, when it was detected, when it was contained.
2. Root cause: What failed or was misconfigured.
3. Impact: What data, systems, or access was affected.
4. Remediation: What was done to contain and recover.
5. Prevention: What control changes prevent recurrence.

The review document is retained as part of the security record.

## 8. Contact Information

**Primary responder (sole operator):** Allison Fabbri  
**Contact:** allison@cardealer.ai  

**Vendor security contacts:**
- Replit: support.replit.com (security issues)
- Neon: console.neon.tech → Support
- GitHub: github.com/contact/report-security
- Google Cloud: cloud.google.com/support
- Intuit: developer.intuit.com → Support

> Note: No external incident response retainer is currently in place. This may be revisited as FinanceOS expands.

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*

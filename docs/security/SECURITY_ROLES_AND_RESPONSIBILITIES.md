> **DRAFT — NOT YET APPROVED.** This document requires review and approval by Allison Fabbri before becoming effective. Effective date: [PENDING APPROVAL]

# Security Roles and Responsibilities

**Version:** 0.1-draft  
**Owner:** Allison Fabbri (allison@cardealer.ai)  
**Last Updated:** 2026-07-21  
**Review Frequency:** Annually or upon team expansion  

---

## 1. Current State: Single Operator

FinanceOS currently has one operator. All security responsibilities are held by:

**Allison Fabbri**  
Role: Operator / Security Engineering Lead  
Contact: allison@cardealer.ai  

This is an acknowledged risk of a single-operator system. Controls are designed to be maintainable by one person while providing documented procedures that could be handed off or expanded.

## 2. Responsibilities

### 2.1 Secret Management

- Rotate credentials per schedule or upon any suspected compromise.
- Maintain the inventory of secrets across Replit Secrets, GitHub Encrypted Secrets, and GCP Secret Manager.
- Ensure no plaintext credentials are stored in source code or local dotfiles.
- Verify API keys are revoked for any vendor integration that is removed.

**Cadence:** Review annually; rotate on compromise.

### 2.2 Dependency Updates and Vulnerability Remediation

- Review Dependabot alerts and `pnpm audit` results weekly (once Dependabot is configured).
- Remediate Critical vulnerabilities within 7 days, High within 30 days (per Vulnerability and Patch Management Policy).
- Keep Node.js and Python runtimes on supported versions.

**Cadence:** Weekly audit review; SLA-driven remediation.

### 2.3 Access Review

- Review application user accounts and their roles.
- Verify platform MFA status on all vendor consoles (see MFA Verification Checklist).
- Review GitHub repository collaborators and branch protection settings.
- Review Neon database user roles.

**Cadence:** Annually, or when a user is added or removed.

### 2.4 Incident Response

- Serve as the sole responder for all security incidents.
- Follow `docs/security/INCIDENT_RESPONSE_PLAN.md` for containment, evidence preservation, and recovery.
- Complete post-incident reviews within 5 business days for P1/P2 incidents.

**Cadence:** As incidents occur.

### 2.5 Policy Maintenance

- Review and update all security policy documents annually.
- Update documents immediately upon material change to the system (new vendor, new integration, infrastructure change).
- Maintain the Security Control Evidence Register (`docs/security/SECURITY_CONTROL_EVIDENCE_REGISTER.md`).

**Cadence:** Annual review; updates as needed.

### 2.6 Vendor Security Assessment

- Review vendor security posture annually per `docs/security/THIRD_PARTY_AND_VENDOR_SECURITY_POLICY.md`.
- Assess any new vendor before integration.
- Monitor vendor breach notifications and respond per the IRP.

**Cadence:** Annually; as-needed for new vendors.

### 2.7 Endpoint Device Security

- Maintain macOS security updates, FileVault, and screen lock per the Endpoint Device Security Checklist.
- Verify browser auto-updates are enabled.
- Ensure no plaintext credentials are present in local files.

**Cadence:** Quarterly manual check; automatic where possible.

## 3. Security Review Cadence Summary

| Activity | Frequency |
|---|---|
| Dependabot / audit results review | Weekly |
| Incident response (if applicable) | As incidents occur |
| Endpoint device security check | Quarterly |
| Platform MFA verification | Annually |
| Access review (users, roles, collaborators) | Annually |
| Vendor security review | Annually |
| Secret rotation (scheduled) | Annually |
| Policy review and update | Annually |

## 4. Future Role Expansion Plan

When FinanceOS expands beyond a single operator, responsibilities should be divided as follows (illustrative — to be formalized at that time):

| Role | Responsibilities |
|---|---|
| Security Lead | Policy ownership, incident command, vendor assessment, access review |
| Engineering Lead | Dependency updates, code security review, infrastructure configuration |
| Operations | Day-to-day secret rotation, endpoint compliance, audit log review |

Any new user with access to production systems must:
- Complete security onboarding (policy review, MFA setup)
- Be provisioned with the minimum role required (principle of least privilege)
- Be added to the access review register

---

*Document version: 0.1-draft. Approved version number to be assigned upon approval.*

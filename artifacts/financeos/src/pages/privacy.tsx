import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import { ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. Scope and purpose",
    content: (
      <>
        <p>
          FinanceOS is a private, internal financial operations and reporting platform used only by
          authorized personnel working for CarDealer.ai and its affiliated companies: T3 Marketing,
          CarDealer.ai, TopMrktr, and Smile More.
        </p>
        <p>
          FinanceOS is not sold or offered to external clients, does not provide external customer
          accounts, and is not available to the general public. This public policy page is provided
          for transparency; it does not provide access to the FinanceOS application.
        </p>
      </>
    ),
  },
  {
    title: "2. Information FinanceOS processes",
    content: (
      <>
        <h3>Business financial and accounting information</h3>
        <p>
          FinanceOS imports and derives authorized business records from QuickBooks Online,
          including chart-of-accounts and general-ledger information; invoices, bills, payments,
          credits, customers and vendors; accounts receivable and payable; financial statements;
          and reporting, validation, reconciliation and historical snapshots.
        </p>
        <p>
          These records may include personal information when a customer, vendor, employee or
          business contact is identifiable. FinanceOS treats that information as protected data.
        </p>
        <h3>Authorized-user, security and operational information</h3>
        <p>
          FinanceOS processes the minimum information required to authenticate and authorize
          approved personnel, including business email, assigned role, password hashes,
          encrypted multi-factor-authentication enrollment data, session data, consent records,
          audit events, synchronization runs and validation outcomes.
        </p>
        <h3>Planned Plaid information</h3>
        <p>
          Plaid is not yet active in production. When enabled, Plaid Link will be used only by an
          authorized internal representative connecting a business bank account belonging to a
          managed group company. FinanceOS will not invite external customers to connect accounts
          or use Plaid to connect personal bank accounts.
        </p>
      </>
    ),
  },
  {
    title: "3. Purposes of processing",
    content: (
      <>
        <p>FinanceOS processes information only for legitimate internal business purposes:</p>
        <ul>
          <li>accounting, reconciliation and financial reporting;</li>
          <li>cash, receivables, payables and transaction monitoring;</li>
          <li>validation, audit trails and issue investigation;</li>
          <li>authentication, authorization and platform security; and</li>
          <li>legal, tax, regulatory and contractual recordkeeping.</li>
        </ul>
        <p>FinanceOS does not sell personal information or use financial information for advertising.</p>
      </>
    ),
  },
  {
    title: "4. Data sources and consent",
    content: (
      <p>
        Information is obtained from authorized group-company systems and authorized internal users.
        QuickBooks Online access uses OAuth authorization. Before a Plaid connection is created, the
        authorized company representative must receive a clear disclosure, confirm authority to
        connect the applicable business account, and provide affirmative consent through the
        FinanceOS/Plaid Link flow. FinanceOS records the applicable policy version and consent event.
      </p>
    ),
  },
  {
    title: "5. Storage, security and access",
    content: (
      <>
        <p>
          Financial data is stored in the FinanceOS Core PostgreSQL database. Application security,
          session, consent and other Dashboard-owned operational records are stored separately in
          the FinanceOS operational PostgreSQL database.
        </p>
        <p>Controls include:</p>
        <ul>
          <li>TLS encryption for data in transit and provider-managed encryption at rest;</li>
          <li>role-based access controls and least-privilege access;</li>
          <li>multi-factor authentication for FinanceOS and critical administrative platforms;</li>
          <li>encrypted storage for application-managed authenticator secrets; and</li>
          <li>restricted secrets management outside source control.</li>
        </ul>
        <p>Access is limited to authorized personnel with a legitimate business need.</p>
      </>
    ),
  },
  {
    title: "6. Service providers",
    content: (
      <>
        <p>
          Depending on the feature, FinanceOS may use Neon for database hosting, Replit for
          development and application hosting, Google for business identity and approved
          integrations, Intuit/QuickBooks Online for accounting records, GitHub for source control
          and change review, Anthropic for explicitly enabled AI-assisted features, and Plaid for
          planned business-bank connectivity.
        </p>
        <p>
          FinanceOS shares only the information reasonably necessary for the relevant service and
          configuration. GitHub is not intended to receive production financial records or secrets.
        </p>
      </>
    ),
  },
  {
    title: "7. Data retention",
    content: (
      <p>
        Information is retained only while needed for an approved business, legal, security or audit
        purpose. Specific periods and deletion procedures are defined in the FinanceOS Data Retention
        and Deletion Policy. Seven years is a conservative internal period for core accounting books
        and supporting records, not a universal legal rule for every category.
      </p>
    ),
  },
  {
    title: "8. Access, correction and deletion requests",
    content: (
      <>
        <p>
          Authorized users or affected individuals may request access, correction, restriction or
          deletion by emailing <a href="mailto:allison@cardealer.ai">allison@cardealer.ai</a>.
        </p>
        <p>
          FinanceOS verifies the requester and evaluates each request against applicable accounting,
          tax, contractual, security and legal-hold requirements. If deletion cannot be completed,
          the applicable reason will be communicated when appropriate.
        </p>
      </>
    ),
  },
  {
    title: "9. Security incidents",
    content: (
      <p>
        Suspected unauthorized access, disclosure, alteration or loss of FinanceOS information must
        be reported immediately to <a href="mailto:allison@cardealer.ai">allison@cardealer.ai</a> and
        handled under the FinanceOS Incident Response Plan.
      </p>
    ),
  },
  {
    title: "10. Policy changes",
    content: (
      <p>
        Material changes are versioned, reviewed, approved and communicated to authorized internal
        users. This policy will be updated before Plaid production use to reflect the final,
        verified data flow. Publishing this policy does not make FinanceOS publicly accessible.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-800">
      <header className="border-b border-emerald-950/10 bg-[#173c2d] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <FinanceOSLogo variant="full" className="h-12 w-auto brightness-0 invert" />
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Internal financial platform
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mb-10 border-b border-slate-200 pb-9">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Privacy & data protection
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            FinanceOS Privacy Policy
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
            This policy explains how FinanceOS processes and protects information within the private
            financial operations platform used by CarDealer.ai and its affiliated companies.
          </p>

          <dl className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</dt>
              <dd className="mt-1 font-semibold text-slate-900">1.0</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Effective</dt>
              <dd className="mt-1 font-semibold text-slate-900">July 22, 2026</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Privacy contact</dt>
              <dd className="mt-1 font-semibold"><a href="mailto:allison@cardealer.ai">allison@cardealer.ai</a></dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <nav aria-label="Privacy policy sections" className="sticky top-8 space-y-2 text-sm text-slate-500">
              {sections.map((section, index) => (
                <a key={section.title} href={`#section-${index + 1}`} className="block rounded-md px-3 py-2 hover:bg-white hover:text-emerald-800">
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm sm:px-10">
            {sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-8 border-b border-slate-100 py-8 last:border-0">
                <h2 className="mb-4 text-xl font-semibold text-slate-950">{section.title}</h2>
                <div className="space-y-4 text-[15px] leading-7 text-slate-600 [&_a]:font-medium [&_a]:text-emerald-700 [&_a]:underline [&_a]:underline-offset-2 [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-slate-800 [&_li]:ml-5 [&_li]:list-disc">
                  {section.content}
                </div>
              </section>
            ))}

            <section className="py-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-950">Approval</h2>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
                <p><strong>Approved by:</strong> Allison Fabbri, Controller &amp; FinanceOS Project Lead</p>
                <p><strong>Approval date:</strong> July 22, 2026</p>
              </div>
              <p className="mt-6 text-xs leading-5 text-slate-500">
                This policy describes current controls and clearly identifies planned controls. It is
                not legal advice; requirements must be confirmed for each applicable entity and jurisdiction.
              </p>
            </section>
          </article>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FinanceOS. Internal financial operations platform.</span>
          <a href="mailto:allison@cardealer.ai" className="font-medium text-emerald-700">Privacy contact</a>
        </div>
      </footer>
    </main>
  );
}

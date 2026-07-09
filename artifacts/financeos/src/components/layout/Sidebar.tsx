
import { useState, useRef, useEffect } from "react";
import Link from "@/lib/next-compat";
import { usePathname, useRouter } from "@/lib/next-compat";
import { motion, AnimatePresence } from "framer-motion";
import type { ComponentType } from "react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import {
  LayoutDashboard, Inbox, TrendingUp, FileText,
  ShieldCheck, CheckCircle2, Clock, Settings, ChevronDown,
  Layers, Droplets, X, Check, LogOut,
  BookOpen, CreditCard, Scale,
} from "lucide-react";
import { useEntitySelection } from "@/lib/entity-context";
import {
  ENTITY_META, ENTITY_META_LIST, PORTFOLIO_META, AGENCY_META,
  AGENCY_SLUGS, ENTITY_SLUGS,
  type EntitySlug,
} from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";
import { getMockData } from "@/lib/mock";
import { computeHealthScore, healthLabel } from "@/lib/briefing";
import { useAuth } from "@/lib/auth";

// Pre-compute health scores once at module load (mock data is static)
const _data = getMockData();
const HEALTH: Record<EntitySlug, { score: number; label: string }> = Object.fromEntries(
  ENTITY_SLUGS.map(s => {
    const score = computeHealthScore(_data.metrics[s]);
    return [s, { score, label: healthLabel(score) }];
  })
) as Record<EntitySlug, { score: number; label: string }>;

type LucideIcon = ComponentType<{ className?: string }>;

const BG      = "#1B3A2C";
const MUTED   = "rgba(255,255,255,0.40)";
const DIVIDER = "rgba(255,255,255,0.07)";
const SURFACE = "rgba(255,255,255,0.06)";
const ease    = [0.16, 1, 0.3, 1] as [number, number, number, number];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  cfo: "CFO",
  controller: "Controller",
  bookkeeper: "Bookkeeper",
  investor: "Investor",
  readonly: "Read-only",
};

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { selected, selectAll, setAgency } = useEntitySelection();
  const { user, logout } = useAuth();

  // Derive current workspace context
  const rawSlug = pathname.startsWith("/entity/") ? pathname.split("/")[2] : null;
  const currentSlug: EntitySlug | null =
    rawSlug && (ENTITY_SLUGS as readonly string[]).includes(rawSlug)
      ? (rawSlug as EntitySlug)
      : null;
  const isAgency    = !currentSlug &&
    selected.length === AGENCY_SLUGS.length &&
    AGENCY_SLUGS.every(s => selected.includes(s)) &&
    !ENTITY_SLUGS.filter(s => !AGENCY_SLUGS.includes(s)).some(s => selected.includes(s));
  const isPortfolio = !currentSlug && !isAgency;

  const currentMeta = currentSlug
    ? ENTITY_META[currentSlug]
    : isAgency
    ? AGENCY_META
    : PORTFOLIO_META;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleSelect = (action: "portfolio" | "agency" | EntitySlug) => {
    setOpen(false);
    if (action === "portfolio") { selectAll(); router.push("/"); }
    else if (action === "agency") { setAgency(); router.push("/"); }
    else { router.push(`/entity/${action}`); }
  };

  return (
    <aside
      className="flex flex-col overflow-hidden select-none h-full"
      style={{ background: BG, width: 216, minHeight: "100vh" }}
    >
      {/* Logo row */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        <FinanceOSLogo variant="sidebar" className="flex-1 min-w-0" />
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Workspace switcher ─────────────────────────────── */}
      <div className="px-3 pb-3" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-left"
          style={{
            background: open ? "rgba(255,255,255,0.10)" : SURFACE,
            border: `1px solid ${open ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <EntityLogo entity={currentMeta} size={30} rounded="lg" dark />

          <div className="flex-1 min-w-0">
            <p className="text-white text-[12px] font-semibold truncate leading-tight">
              {currentMeta.name}
            </p>
            <p className="text-[9px] leading-tight mt-0.5" style={{ color: MUTED }}>
              {currentSlug
                ? `${ENTITY_META[currentSlug].basis} · ${HEALTH[currentSlug].label} · ${HEALTH[currentSlug].score}`
                : isAgency
                ? `${AGENCY_SLUGS.length} agencies · filtered`
                : `All ${ENTITY_SLUGS.length} entities`}
            </p>
          </div>

          <ChevronDown
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
            style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="mt-1.5 rounded-xl overflow-hidden"
              style={{
                background: "#132D20",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
              }}
              initial={{ opacity: 0, y: -8, scaleY: 0.92 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
              transition={{ duration: 0.14, ease }}
            >
              {/* Portfolio + Agency */}
              <div className="py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <WorkspaceItem
                  meta={PORTFOLIO_META}
                  active={isPortfolio}
                  onSelect={() => handleSelect("portfolio")}
                  sub="All 4 entities"
                  dark
                />
                <WorkspaceItem
                  meta={AGENCY_META}
                  active={isAgency}
                  onSelect={() => handleSelect("agency")}
                  sub={AGENCY_SLUGS.map(s => ENTITY_META[s].shortName).join(" · ")}
                  dark
                />
              </div>

              {/* Individual entities */}
              <div className="py-1.5">
                <p
                  className="px-3 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  Entities
                </p>
                {ENTITY_META_LIST.map(meta => {
                  const h = HEALTH[meta.slug];
                  const healthColor = h.score >= 85 ? "#34D399" : h.score >= 70 ? "#FBBF24" : "#F87171";
                  return (
                    <EntityWorkspaceItem
                      key={meta.slug}
                      meta={meta}
                      active={currentSlug === meta.slug}
                      onSelect={() => handleSelect(meta.slug)}
                      basis={meta.basis}
                      healthLabel={h.label}
                      healthScore={h.score}
                      healthColor={healthColor}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 mb-2" style={{ borderTop: `1px solid ${DIVIDER}` }} />

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-2 overflow-y-auto pb-3 space-y-3">
        <Section label="Portfolio">
          <NavItem icon={LayoutDashboard} label="Overview"     href="/"                        active={pathname === "/"} />
        </Section>
        <Section label="Operations">
          <NavItem icon={Inbox}          label="Inbox"         href="/operations"              active={pathname.startsWith("/operations")} />
        </Section>
        <Section label="Analyze">
          <NavItem icon={TrendingUp}     label="Performance"   href="/analyze/performance"     active={pathname.startsWith("/analyze/performance")} />
          <NavItem icon={Layers}         label="Consolidated"  href="/analyze/consolidated"    active={pathname.startsWith("/analyze/consolidated")} />
          <NavItem icon={Droplets}       label="Cash Flow"     href="/analyze/cashflow"        active={pathname.startsWith("/analyze/cashflow")} />
          <NavItem icon={Clock}          label="History"       href="/analyze/history"         active={pathname.startsWith("/analyze/history")} />
        </Section>
        <Section label="Accounting">
          <NavItem icon={BookOpen}       label="Overview"      href="/accounting"                           active={pathname === "/accounting"} />
          <NavItem icon={CreditCard}     label="Transactions"  href="/accounting/transactions"              active={pathname.startsWith("/accounting/transactions")} />
          <NavItem icon={Scale}          label="Reconciliation" href="/accounting/reconciliation"           active={pathname.startsWith("/accounting/reconciliation")} />
        </Section>
        <Section label="Reports">
          <NavItem icon={FileText}       label="Report Center" href="/reports"                 active={pathname.startsWith("/reports")} />
        </Section>
        <Section label="Control">
          <NavItem icon={ShieldCheck}    label="Integrity"     href="/control/integrity"       active={pathname.startsWith("/control/integrity")}  badge={98}  badgeColor="#10B981" />
          <NavItem icon={CheckCircle2}   label="Validation"    href="/control/validation"      active={pathname.startsWith("/control/validation")} badge={40}  badgeColor="#10B981" />
          <NavItem icon={Settings}       label="Settings"      href="/control/settings"        active={pathname.startsWith("/control/settings")} />
        </Section>
      </nav>

      {/* Profile card */}
      <div className="mx-3 mb-3 relative" ref={profileRef}>
        <AnimatePresence>
          {profileOpen && (
            <motion.div
              className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl overflow-hidden"
              style={{
                background: "#132D20",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
              }}
              initial={{ opacity: 0, y: 6, scaleY: 0.92 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: 4, scaleY: 0.95 }}
              transition={{ duration: 0.14, ease }}
            >
              <button
                onClick={() => { setProfileOpen(false); void logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <LogOut className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MUTED }} />
                <span className="text-[11px] font-medium text-white">Sign out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div
          onClick={() => setProfileOpen(v => !v)}
          className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer"
          style={{ background: profileOpen ? "rgba(255,255,255,0.10)" : SURFACE }}
        >
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">
              {(user?.name ?? "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[10px] font-semibold truncate">{user?.name ?? "Loading…"}</p>
            <p className="text-[9px]" style={{ color: MUTED }}>{user ? (ROLE_LABEL[user.role] ?? user.role) : ""}</p>
          </div>
          <ChevronDown
            className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
            style={{ color: MUTED, transform: profileOpen ? "rotate(180deg)" : "none" }}
          />
        </div>
      </div>
    </aside>
  );
}

// ── WorkspaceItem ────────────────────────────────────────────────────────────

function WorkspaceItem({
  meta, active, onSelect, sub, dark,
}: {
  meta: { name: string; shortName: string; color: string; logoPath: string | null; initials: string };
  active: boolean;
  onSelect: () => void;
  sub: string;
  dark: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors"
      style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.08)" : "transparent"; }}
    >
      <EntityLogo entity={meta} size={26} rounded="md" dark={dark} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[11px] font-semibold truncate" style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)" }}>
          {meta.name}
        </p>
        {sub && (
          <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.28)" }}>{sub}</p>
        )}
      </div>
      {active && <Check className="w-3 h-3 flex-shrink-0 text-emerald-400" />}
    </button>
  );
}

// ── EntityWorkspaceItem — premium card with live health ──────────────────────

function EntityWorkspaceItem({
  meta, active, onSelect, basis, healthLabel, healthScore, healthColor,
}: {
  meta: { name: string; shortName: string; color: string; logoPath: string | null; initials: string };
  active: boolean;
  onSelect: () => void;
  basis: string;
  healthLabel: string;
  healthScore: number;
  healthColor: string;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left group"
      style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.08)" : "transparent"; }}
    >
      <EntityLogo entity={meta} size={28} rounded="md" dark />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[11px] font-semibold truncate leading-tight" style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.75)" }}>
          {meta.name}
        </p>
        <p className="text-[9px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
          {basis}
          <span className="mx-1">·</span>
          <span style={{ color: healthColor }}>{healthLabel}</span>
          <span className="mx-1" style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
          <span style={{ color: healthColor }}>{healthScore}</span>
        </p>
      </div>
      {active && <Check className="w-3 h-3 flex-shrink-0 text-emerald-400" />}
    </button>
  );
}

// ── Section + NavItem ────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  icon: Icon, label, href, active, badge, badgeColor,
}: {
  icon: LucideIcon; label: string; href: string;
  active?: boolean; badge?: number; badgeColor?: string;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] w-full font-medium transition-colors ${
        active ? "" : "hover:bg-white/5"
      }`}
      style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.55)" }}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bg"
          className="absolute inset-0 rounded-lg"
          style={{ background: "rgba(16,185,129,0.12)", borderLeft: "2px solid #10B981" }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span style={{ color: active ? "#34D399" : "rgba(255,255,255,0.45)", display: "contents" }}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
      </span>
      <span className="flex-1 truncate relative z-10">{label}</span>
      {badge !== undefined && (
        <span
          className="text-[9px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0 leading-none relative z-10"
          style={{
            background: badgeColor ? `${badgeColor}22` : "rgba(239,68,68,0.2)",
            color: badgeColor ?? "#EF4444",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

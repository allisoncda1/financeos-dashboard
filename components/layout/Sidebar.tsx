"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ComponentType } from "react";
import {
  BarChart3, LayoutDashboard, Inbox, TrendingUp, FileText,
  ShieldCheck, CheckCircle2, Clock, Settings, ChevronDown,
  Layers, Droplets, X, Check, Users,
} from "lucide-react";
import { useEntitySelection } from "@/lib/entity-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/types";

type LucideIcon = ComponentType<{ className?: string }>;

const BG       = "#1B3A2C";
const MUTED    = "rgba(255,255,255,0.40)";
const DIVIDER  = "rgba(255,255,255,0.07)";
const SURFACE  = "rgba(255,255,255,0.06)";
const ease     = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { selected, selectAll, setAgency } = useEntitySelection();

  // Derive current context label + color
  const currentSlug: EntitySlug | null = pathname.startsWith("/entity/")
    ? (pathname.replace("/entity/", "") as EntitySlug)
    : null;
  const isAgency  = !currentSlug && selected.length === 3 && !selected.includes("CarDealer_ai");
  const isPortfolio = !currentSlug && !isAgency;

  const contextLabel = currentSlug
    ? ENTITY_CONFIG[currentSlug]?.name ?? "Entity"
    : isAgency
    ? "Agency only"
    : "Portfolio";

  const contextColor = currentSlug
    ? ENTITY_CONFIG[currentSlug]?.color
    : isAgency
    ? "#8B5CF6"
    : "#10B981";

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const handleSelect = (action: "portfolio" | "agency" | EntitySlug) => {
    setOpen(false);
    if (action === "portfolio") {
      selectAll();
      router.push("/");
    } else if (action === "agency") {
      setAgency();
      router.push("/");
    } else {
      router.push(`/entity/${action}`);
    }
  };

  return (
    <aside
      className="flex flex-col overflow-hidden select-none h-full"
      style={{ background: BG, width: 216, minHeight: "100vh" }}
    >
      {/* ── Logo + mobile close ── */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-[13px] tracking-widest flex-1">FINANCEOS</span>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Workspace / Entity selector ── */}
      <div className="px-3 pb-3" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
          style={{
            background: open ? "rgba(255,255,255,0.10)" : SURFACE,
            border: `1px solid ${open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {/* Context dot / avatar */}
          <span
            className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: `${contextColor}28` }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: contextColor }} />
          </span>

          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-[12px] font-semibold truncate leading-tight">{contextLabel}</p>
            <p className="text-[9px] leading-tight" style={{ color: MUTED }}>
              {currentSlug ? "Entity view" : isAgency ? "3 entities" : "All 4 entities"}
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
              className="mt-1.5 rounded-xl overflow-hidden z-50"
              style={{
                background: "#132D20",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
              }}
              initial={{ opacity: 0, y: -6, scaleY: 0.94 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
              transition={{ duration: 0.15, ease }}
            >
              {/* Portfolio + Agency */}
              <div className="py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <SwitcherItem
                  label="Portfolio"
                  sub="All 4 entities"
                  color="#10B981"
                  active={isPortfolio}
                  onSelect={() => handleSelect("portfolio")}
                />
                <SwitcherItem
                  label="Agency only"
                  sub="T3 · TopMrktr · Smile More"
                  color="#8B5CF6"
                  active={isAgency}
                  onSelect={() => handleSelect("agency")}
                />
              </div>

              {/* Individual entities */}
              <div className="py-1.5">
                <p className="px-3 pt-0.5 pb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
                  Entities
                </p>
                {ENTITY_SLUGS.map(slug => {
                  const cfg = ENTITY_CONFIG[slug];
                  return (
                    <SwitcherItem
                      key={slug}
                      label={cfg.name}
                      sub={cfg.basis ?? ""}
                      color={cfg.color}
                      active={currentSlug === slug}
                      onSelect={() => handleSelect(slug)}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 mb-2" style={{ borderTop: `1px solid ${DIVIDER}` }} />

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 overflow-y-auto pb-3 space-y-3">
        <Section label="Portfolio">
          <NavItem icon={LayoutDashboard} label="Overview"    href="/"                         active={pathname === "/" || pathname === ""} />
        </Section>
        <Section label="Operations">
          <NavItem icon={Inbox}          label="Inbox"        href="/operations"               active={pathname.startsWith("/operations")} />
        </Section>
        <Section label="Analyze">
          <NavItem icon={TrendingUp}     label="Performance"  href="/analyze/performance"      active={pathname.startsWith("/analyze/performance")} />
          <NavItem icon={Layers}         label="Consolidated" href="/analyze/consolidated"     active={pathname.startsWith("/analyze/consolidated")} />
          <NavItem icon={Droplets}       label="Cash Flow"    href="/analyze/cashflow"         active={pathname.startsWith("/analyze/cashflow")} />
          <NavItem icon={Clock}          label="History"      href="/analyze/history"          active={pathname.startsWith("/analyze/history")} />
        </Section>
        <Section label="Reports">
          <NavItem icon={FileText}       label="Report Center" href="/reports"                 active={pathname.startsWith("/reports")} />
        </Section>
        <Section label="Control">
          <NavItem icon={ShieldCheck}    label="Integrity"    href="/control/integrity"        active={pathname.startsWith("/control/integrity")}  badge={98}  badgeColor="#10B981" />
          <NavItem icon={CheckCircle2}   label="Validation"   href="/control/validation"       active={pathname.startsWith("/control/validation")} badge={40}  badgeColor="#10B981" />
          <NavItem icon={Settings}       label="Settings"     href="/control/settings"         active={pathname.startsWith("/control/settings")} />
        </Section>
      </nav>

      {/* ── Profile card ── */}
      <div className="mx-3 mb-3">
        <div className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer" style={{ background: SURFACE }}>
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">AF</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[10px] font-semibold truncate">Allison Fabbri</p>
            <p className="text-[9px]" style={{ color: MUTED }}>Bookkeeper</p>
          </div>
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: MUTED }} />
        </div>
      </div>
    </aside>
  );
}

// ── Switcher item ────────────────────────────────────────────────────────────

function SwitcherItem({
  label, sub, color, active, onSelect,
}: {
  label: string; sub: string; color: string; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors"
      style={{ background: active ? "rgba(255,255,255,0.07)" : "transparent" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? "rgba(255,255,255,0.07)" : "transparent"; }}
    >
      <span className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center" style={{ background: `${color}28` }}>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      </span>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[11px] font-semibold truncate" style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)" }}>{label}</p>
        {sub && <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.30)" }}>{sub}</p>}
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
        active ? "" : "hover:bg-white/5 hover:text-white/90"
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

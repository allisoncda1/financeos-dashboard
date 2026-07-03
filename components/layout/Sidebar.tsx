"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import {
  BarChart3, LayoutDashboard, Inbox, TrendingUp, FileText,
  ShieldCheck, CheckCircle2, Clock, Settings, ChevronDown,
  Layers, Droplets, X,
} from "lucide-react";

type LucideIcon = ComponentType<{ className?: string }>;

const BG = "#1B3A2C";
const MUTED = "rgba(255,255,255,0.40)";
const DIVIDER = "rgba(255,255,255,0.07)";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col overflow-hidden select-none h-full"
      style={{ background: BG, width: 216, minHeight: "100vh" }}
    >
      {/* ── Logo + mobile close ──────────────────────────── */}
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

      <div className="mx-3 mb-2" style={{ borderTop: `1px solid ${DIVIDER}` }} />

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="flex-1 px-2 overflow-y-auto pb-3 space-y-3">

        {/* PORTFOLIO */}
        <Section label="Portfolio">
          <NavItem icon={LayoutDashboard} label="Overview"     href="/"           active={pathname === "/" || pathname === ""} />
        </Section>

        {/* OPERATIONS */}
        <Section label="Operations">
          <NavItem icon={Inbox}          label="Inbox"         href="/operations"  active={pathname.startsWith("/operations")} />
        </Section>

        {/* ANALYZE */}
        <Section label="Analyze">
          <NavItem icon={TrendingUp}     label="Performance"   href="/analyze/performance"  active={pathname.startsWith("/analyze/performance")} />
          <NavItem icon={Layers}         label="Consolidated"  href="/analyze/consolidated" active={pathname.startsWith("/analyze/consolidated")} />
          <NavItem icon={Droplets}       label="Cash Flow"     href="/analyze/cashflow"     active={pathname.startsWith("/analyze/cashflow")} />
          <NavItem icon={Clock}          label="History"       href="/analyze/history"      active={pathname.startsWith("/analyze/history")} />
        </Section>

        {/* REPORTS */}
        <Section label="Reports">
          <NavItem icon={FileText}       label="Report Center" href="/reports"     active={pathname.startsWith("/reports")} />
        </Section>

        {/* CONTROL */}
        <Section label="Control">
          <NavItem icon={ShieldCheck}    label="Integrity"     href="/control/integrity"   active={pathname.startsWith("/control/integrity")}  badge={98}  badgeColor="#10B981" />
          <NavItem icon={CheckCircle2}   label="Validation"    href="/control/validation"  active={pathname.startsWith("/control/validation")} badge={40}  badgeColor="#10B981" />
          <NavItem icon={Settings}       label="Settings"      href="/control/settings"    active={pathname.startsWith("/control/settings")} />
        </Section>
      </nav>

      {/* ── Profile card ─────────────────────────────────── */}
      <div className="mx-3 mb-3">
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
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

// ── Helpers ─────────────────────────────────────────────────────────────────

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

import { useState, useRef, useEffect } from "react";
import Link from "@/lib/next-compat";
import { usePathname } from "@/lib/next-compat";
import { motion, AnimatePresence } from "framer-motion";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Calculator,
  BarChart3,
  Network,
  History,
  Lightbulb,
  FileText,
  Settings,
  HelpCircle,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { FinanceOSLogo } from "@/components/ui/FinanceOSLogo";
import { useAuth } from "@/lib/auth";

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

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/budget" },
  { label: "Budget Builder", icon: Calculator, href: "/budget/builder" },
  { label: "Budget vs Actual", icon: BarChart3, href: "/budget/budget-vs-actual" },
  { label: "Department Budgets", icon: Network, href: "/budget/departments" },
  { label: "Budget Versions", icon: History, href: "/budget/versions" },
  { label: "Assumptions", icon: Lightbulb, href: "/budget/assumptions" },
  { label: "Reports", icon: FileText, href: "/budget/reports" },
  { label: "Settings", icon: Settings, href: "/budget/settings" },
];

export function BudgetSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <aside
      className="flex flex-col overflow-hidden select-none h-full shrink-0"
      style={{ background: BG, width: 216, minHeight: "100vh" }}
    >
      {/* Logo row */}
      <div className="relative px-4 py-4 flex items-center justify-center">
        <Link
          href="/home"
          aria-label="Back to launcher"
          title="Back to launcher"
          className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-80"
        >
          <FinanceOSLogo variant="sidebar" className="h-11 w-auto" />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mx-3 mb-2 mt-2" style={{ borderTop: `1px solid ${DIVIDER}` }} />

      {/* Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto pb-3 space-y-3 mt-2">
        <Section label="Budget Module">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/budget"
                ? pathname === "/budget" ||
                  ["/budget/pnl", "/budget/cash-flow", "/budget/balance-sheet"].includes(pathname)
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={isActive}
              />
            );
          })}
        </Section>
      </nav>

      {/* Help Link */}
      <div className="px-5 mb-4">
        <a
          href="#"
          className="flex items-center gap-2 text-[11px] font-medium transition-colors"
          style={{ color: MUTED }}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Need help?
        </a>
      </div>

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
          layoutId="nav-active-bg-budget"
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

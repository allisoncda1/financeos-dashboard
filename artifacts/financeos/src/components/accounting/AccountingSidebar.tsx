import { useState, useRef, useEffect } from "react";
import Link from "@/lib/next-compat";
import { usePathname } from "@/lib/next-compat";
import { motion, AnimatePresence } from "framer-motion";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  CheckCircle,
  Users,
  Building2,
  List,
  GitMerge,
  BookOpen,
  Archive,
  CalendarCheck,
  Settings,
  X,
  ChevronDown,
  LogOut,
  HelpCircle,
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

export function AccountingSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(() => pathname.startsWith("/accounting/invoices"));
  const [bankOpen, setBankOpen] = useState(() => pathname.startsWith("/accounting/transactions"));
  const [recOpen, setRecOpen] = useState(() => pathname.startsWith("/accounting/reconciliation"));

  useEffect(() => {
    if (pathname.startsWith("/accounting/invoices")) setInvoicesOpen(true);
    if (pathname.startsWith("/accounting/transactions")) setBankOpen(true);
    if (pathname.startsWith("/accounting/reconciliation")) setRecOpen(true);
  }, [pathname]);
  
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
        <Section label="Accounting Module">
          <NavItem
            icon={LayoutDashboard}
            label="Workspace"
            href="/accounting"
            active={pathname === "/accounting"}
            testId="nav-accounting-workspace"
          />

          {/* Invoices Expandable */}
          <NavGroup
            icon={FileText}
            label="Invoices"
            isOpen={invoicesOpen}
            onToggle={() => setInvoicesOpen(v => !v)}
            active={pathname.startsWith("/accounting/invoices")}
          >
            <SubNavItem label="Draft" href="/accounting/invoices/draft" active={pathname === "/accounting/invoices/draft"} testId="nav-accounting-invoices-draft" />
            <SubNavItem label="Sent" href="/accounting/invoices/sent" active={pathname === "/accounting/invoices/sent"} testId="nav-accounting-invoices-sent" />
            <SubNavItem label="Paid" href="/accounting/invoices/paid" active={pathname === "/accounting/invoices/paid"} testId="nav-accounting-invoices-paid" />
            <SubNavItem label="Recurring" href="/accounting/invoices/recurring" active={pathname === "/accounting/invoices/recurring"} testId="nav-accounting-invoices-recurring" />
          </NavGroup>

          {/* Bank Transactions Expandable */}
          <NavGroup
            icon={CreditCard}
            label="Bank Transactions"
            isOpen={bankOpen}
            onToggle={() => setBankOpen(v => !v)}
            active={pathname.startsWith("/accounting/transactions")}
          >
            <SubNavItem label="Uncategorized" href="/accounting/transactions/uncategorized" active={pathname === "/accounting/transactions/uncategorized"} testId="nav-accounting-transactions-uncategorized" />
            <SubNavItem label="Categorized" href="/accounting/transactions/categorized" active={pathname === "/accounting/transactions/categorized"} testId="nav-accounting-transactions-categorized" />
            <SubNavItem label="Rules" href="/accounting/transactions/rules" active={pathname === "/accounting/transactions/rules"} testId="nav-accounting-transactions-rules" />
          </NavGroup>

          {/* Reconciliation Expandable */}
          <NavGroup
            icon={CheckCircle}
            label="Reconciliation"
            isOpen={recOpen}
            onToggle={() => setRecOpen(v => !v)}
            active={pathname.startsWith("/accounting/reconciliation")}
          >
            <SubNavItem label="Accounts" href="/accounting/reconciliation/accounts" active={pathname === "/accounting/reconciliation/accounts"} testId="nav-accounting-reconciliation-accounts" />
            <SubNavItem label="Match Center" href="/accounting/reconciliation/match-center" active={pathname === "/accounting/reconciliation/match-center"} testId="nav-accounting-reconciliation-match-center" />
            <SubNavItem label="History" href="/accounting/reconciliation/history" active={pathname === "/accounting/reconciliation/history"} testId="nav-accounting-reconciliation-history" />
          </NavGroup>

          <NavItem icon={Users} label="Customers" href="/accounting/customers" active={pathname === "/accounting/customers"} testId="nav-accounting-customers" />
          <NavItem icon={Building2} label="Vendors" href="/accounting/vendors" active={pathname === "/accounting/vendors"} testId="nav-accounting-vendors" />
          <NavItem icon={List} label="Chart of Accounts" href="/accounting/chart-of-accounts" active={pathname === "/accounting/chart-of-accounts"} testId="nav-accounting-chart-of-accounts" />
          <NavItem icon={GitMerge} label="Categorization Rules" href="/accounting/rules" active={pathname === "/accounting/rules"} testId="nav-accounting-rules" />
          <NavItem icon={BookOpen} label="Journal Entries" href="/accounting/journal-entries" active={pathname === "/accounting/journal-entries"} testId="nav-accounting-journal-entries" />
          <NavItem icon={Archive} label="Fixed Assets" href="/accounting/fixed-assets" active={pathname === "/accounting/fixed-assets"} testId="nav-accounting-fixed-assets" />
          <NavItem icon={CalendarCheck} label="Month-End Close" href="/accounting/month-end-close" active={pathname === "/accounting/month-end-close"} testId="nav-accounting-month-end-close" />
          <NavItem icon={Settings} label="Settings" href="/accounting/settings" active={pathname === "/accounting/settings"} testId="nav-accounting-settings" />

        </Section>
      </nav>

      {/* Company card */}
      <div className="px-3 mb-2">
        <div className="bg-white/5 rounded-lg p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-emerald-900/50 flex flex-col items-center justify-center border border-white/10 shrink-0">
             <span className="text-[10px] font-bold text-white leading-none">T3</span>
          </div>
          <div className="flex-1 min-w-0">
             <p className="text-[11px] font-semibold text-white truncate">T3 Marketing LLC</p>
             <p className="text-[9px] text-white/40 truncate">Primary Company</p>
          </div>
        </div>
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
            <p className="text-white text-[10px] font-semibold truncate">{user?.name ?? "Loading..."}</p>
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
  icon: Icon, label, href, active, testId
}: {
  icon: LucideIcon; label: string; href: string; active?: boolean; testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] w-full font-medium transition-colors ${
        active ? "" : "hover:bg-white/5"
      }`}
      style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.55)" }}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bg-accounting"
          className="absolute inset-0 rounded-lg"
          style={{ background: "rgba(16,185,129,0.12)", borderLeft: "2px solid #10B981" }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span style={{ color: active ? "#34D399" : "rgba(255,255,255,0.45)", display: "contents" }}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
      </span>
      <span className="flex-1 truncate relative z-10">{label}</span>
    </Link>
  );
}

function NavGroup({
  icon: Icon, label, isOpen, onToggle, active, children
}: {
  icon: LucideIcon; label: string; isOpen: boolean; onToggle: () => void; active?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] w-full font-medium transition-colors ${
          active && !isOpen ? "" : "hover:bg-white/5"
        }`}
        style={{ color: (active || isOpen) ? "#FFFFFF" : "rgba(255,255,255,0.55)" }}
      >
        {(active && !isOpen) && (
          <motion.span
            layoutId="nav-active-bg-accounting"
            className="absolute inset-0 rounded-lg"
            style={{ background: "rgba(16,185,129,0.12)", borderLeft: "2px solid #10B981" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        <span style={{ color: (active || isOpen) ? "#34D399" : "rgba(255,255,255,0.45)", display: "contents" }}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
        </span>
        <span className="flex-1 text-left truncate relative z-10">{label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 relative z-10 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-6 py-0.5 space-y-0.5 mt-0.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubNavItem({ label, href, active, testId }: { label: string; href: string; active?: boolean; testId?: string; }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`block px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        active ? "text-white bg-white/10" : "text-white/55 hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}

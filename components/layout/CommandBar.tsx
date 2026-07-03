"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import {
  Search, LayoutDashboard, BarChart3, FileText, Clock,
  ShieldCheck, CheckCircle2, Inbox, TrendingUp, Car,
  Users, DollarSign, Settings, X, ArrowRight,
} from "lucide-react";

type LucideIcon = ComponentType<{ className?: string }>;

type Command = {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  category: string;
  color?: string;
};

const COMMANDS: Command[] = [
  // Navigate
  { id: "portfolio",    label: "Portfolio Overview",      desc: "Home · AI briefing · All entities",   icon: LayoutDashboard, href: "/",                      category: "Navigate" },
  { id: "operations",  label: "Operations Inbox",         desc: "Items requiring action",              icon: Inbox,           href: "/operations",            category: "Navigate" },
  { id: "reports",     label: "Report Center",            desc: "Generate PDF, Excel, board packages", icon: FileText,        href: "/reports",               category: "Navigate" },

  // Entities
  { id: "cardealer",   label: "CarDealer.ai",             desc: "Entity Overview · Accrual basis",     icon: Car,             href: "/entity/CarDealer_ai",   category: "Entities", color: "#10B981" },
  { id: "t3",          label: "T3 Marketing",             desc: "Entity Overview · Cash basis",        icon: Car,             href: "/entity/T3_Marketing",   category: "Entities", color: "#F59E0B" },
  { id: "topmrktr",    label: "TopMrktr",                 desc: "Entity Overview · Accrual basis",     icon: Car,             href: "/entity/TopMrktr",       category: "Entities", color: "#8B5CF6" },
  { id: "smilemore",   label: "Smile More",               desc: "Entity Overview · Accrual basis",     icon: Car,             href: "/entity/Smile_More",     category: "Entities", color: "#3B82F6" },

  // Analyze
  { id: "performance", label: "Entity Performance",       desc: "Compare all entities side by side",   icon: BarChart3,       href: "/analyze/performance",   category: "Analyze" },
  { id: "financials",  label: "Consolidated Financials",  desc: "P&L · Balance Sheet · Cash Flow",     icon: DollarSign,      href: "/analyze/financials",    category: "Analyze" },
  { id: "cashflow",    label: "Cash Flow Analysis",       desc: "Portfolio cash trends",               icon: TrendingUp,      href: "/analyze/cash-flow",     category: "Analyze" },
  { id: "history",     label: "History",                  desc: "Timeline · Compare any two dates",    icon: Clock,           href: "/analyze/history",       category: "Analyze" },
  { id: "custvendor",  label: "Customers & Vendors",      desc: "AR / AP analytics across entities",   icon: Users,           href: "/analyze/customers-vendors", category: "Analyze" },

  // Control
  { id: "integrity",   label: "Integrity Center",         desc: "Pipeline health · Data freshness",    icon: ShieldCheck,     href: "/control/integrity",     category: "Control" },
  { id: "validation",  label: "Validation Center",        desc: "40/40 rules · All passed",            icon: CheckCircle2,    href: "/control/validation",    category: "Control" },
  { id: "settings",    label: "Settings",                 desc: "User & system configuration",         icon: Settings,        href: "/control/settings",      category: "Control" },
];

const CATEGORY_ORDER = ["Navigate", "Entities", "Analyze", "Control"];

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Reset & focus when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = query.trim()
    ? COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.desc.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  const handleSelect = useCallback(
    (cmd: Command) => {
      router.push(cmd.href);
      setOpen(false);
    },
    [router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]);
    }
  };

  // Group results by category
  const isSearching = query.trim().length > 0;
  const grouped: Record<string, Command[]> = {};
  if (isSearching) {
    grouped["Results"] = filtered;
  } else {
    CATEGORY_ORDER.forEach((cat) => {
      const items = COMMANDS.filter((c) => c.category === cat);
      if (items.length) grouped[cat] = items;
    });
  }

  // Build flat index map for keyboard selection
  let flatIndex = 0;
  const indexedGroups = Object.entries(grouped).map(([cat, items]) => ({
    cat,
    items: items.map((item) => ({ item, idx: flatIndex++ })),
  }));

  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />

      {/* Panel */}
      <motion.div
        className="fixed z-50 top-[14vh] left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced   ? { opacity: 0 } : { opacity: 0, y: -6,  scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or jump to…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            className="flex-1 text-[13px] text-gray-900 bg-transparent outline-none placeholder-gray-400"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSelectedIdx(0);
                inputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono leading-none">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-5 text-sm text-gray-400 text-center">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            indexedGroups.map(({ cat, items }) => (
              <Fragment key={cat}>
                {!isSearching && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    {cat}
                  </p>
                )}
                {items.map(({ item, idx }) => {
                  const selected = idx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected ? "bg-gray-50" : "hover:bg-gray-50"
                      }`}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => handleSelect(item)}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? "bg-emerald-500" : "bg-gray-100"
                        }`}
                      >
                        <item.icon
                          className={`w-3.5 h-3.5 ${selected ? "text-white" : "text-gray-500"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-gray-900 truncate">
                            {item.label}
                          </span>
                          {item.color && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: item.color }}
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.desc}</p>
                      </div>
                      {selected && (
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <Hint keys={["↑", "↓"]} label="navigate" />
          <Hint keys={["↵"]} label="select" />
          <Hint keys={["ESC"]} label="close" />
          <span className="ml-auto text-[10px] text-gray-400">FinanceOS ⌘K</span>
        </div>
      </motion.div>
    </>
      )}
    </AnimatePresence>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="text-[9px] text-gray-500 bg-white border border-gray-200 px-1 py-0.5 rounded font-mono">
          {k}
        </kbd>
      ))}
      <span className="text-[10px] text-gray-400 ml-0.5">{label}</span>
    </div>
  );
}

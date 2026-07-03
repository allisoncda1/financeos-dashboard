"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown, Check, Users } from "lucide-react";
import { useEntitySelection } from "@/lib/entity-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

const BREADCRUMBS: Record<string, string> = {
  "/": "Portfolio Overview",
  "/operations": "Operations Inbox",
  "/analyze/performance": "Entity Performance",
  "/analyze/consolidated": "Consolidated Financials",
  "/analyze/cashflow": "Cash Flow Analysis",
  "/analyze/history": "History / Time Machine",
  "/reports": "Report Center",
  "/control/integrity": "Integrity Center",
  "/control/validation": "Validation Center",
  "/control/settings": "Settings",
};

const ENTITY_FILTER_PAGES = [
  "/analyze/performance",
  "/analyze/consolidated",
  "/analyze/cashflow",
  "/analyze/history",
];

export function GlobalHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { selected, toggle, selectAll, setAgency, isSelected } = useEntitySelection();

  const title =
    BREADCRUMBS[pathname] ??
    (pathname.startsWith("/entity/") ? "Entity Overview" : "FinanceOS");

  const showFilter = ENTITY_FILTER_PAGES.some(p => pathname.startsWith(p));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSelected = selected.length === ENTITY_SLUGS.length;
  const agencySelected =
    selected.length === 3 &&
    !selected.includes("CarDealer_ai");

  return (
    <header className="flex-shrink-0 h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-30">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="md:hidden flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Page title */}
      <span className="text-[13px] font-semibold text-gray-800 truncate flex-1 min-w-0">
        {title}
      </span>

      {/* Entity selector — only on analyze pages */}
      {showFilter && (
        <div ref={ref} className="relative flex-shrink-0">
          <button
            onClick={() => setOpen(v => !v)}
            className={`flex items-center gap-2 h-7 px-3 rounded-lg border text-[11px] font-semibold transition-colors ${
              open
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:block">
              {allSelected ? "All 4 entities" : `${selected.length} of 4 entities`}
            </span>
            <span className="sm:hidden">{selected.length}/4</span>
            {/* Colored dots for selected entities */}
            <span className="flex items-center gap-0.5">
              {ENTITY_SLUGS.map(slug => (
                <span
                  key={slug}
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
                  style={{
                    background: ENTITY_CONFIG[slug].color,
                    opacity: isSelected(slug) ? 1 : 0.2,
                  }}
                />
              ))}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15, ease }}
              >
                {/* Presets */}
                <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => { selectAll(); setOpen(false); }}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      allSelected
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All 4
                  </button>
                  <button
                    onClick={() => { setAgency(); setOpen(false); }}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      agencySelected
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Agency only (3)
                  </button>
                </div>

                {/* Entity checkboxes */}
                <div className="py-1.5">
                  {ENTITY_SLUGS.map(slug => {
                    const cfg = ENTITY_CONFIG[slug];
                    const checked = isSelected(slug);
                    return (
                      <button
                        key={slug}
                        onClick={() => toggle(slug)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: cfg.color }}
                        />
                        <span className="flex-1 text-[12px] text-gray-700 text-left">{cfg.name}</span>
                        <span className="text-[9px] text-gray-400">{cfg.basis}</span>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                        }`}>
                          {checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Note */}
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <p className="text-[10px] text-gray-400">
                    {selected.length === 1 ? "At least 1 entity required" : `${selected.length} entities included in consolidated views`}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search, X, ArrowUpRight, ChevronRight,
  AlertCircle, AlertTriangle, Info,
  CheckCircle2, Clock, Inbox, Filter,
} from "lucide-react";
import type { OperationItem, OperationSeverity, OperationType, OperationStatus } from "@/lib/operations";
import { TYPE_LABEL } from "@/lib/operations";

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

const LS_KEY = "financeos_op_statuses";

const STATUS_ORDER: OperationStatus[] = ["new", "acknowledged", "in_progress", "resolved"];
const STATUS_LABEL: Record<OperationStatus, string> = {
  new:          "New",
  acknowledged: "Acknowledged",
  in_progress:  "In Progress",
  resolved:     "Resolved",
};
const STATUS_STYLE: Record<OperationStatus, { bg: string; text: string; dot: string }> = {
  new:          { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  acknowledged: { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400" },
  in_progress:  { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-400" },
  resolved:     { bg: "bg-gray-100",  text: "text-gray-400",   dot: "bg-gray-300" },
};
const SEV_COLOR: Record<OperationSeverity, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#3B82F6",
};
const SEV_BG: Record<OperationSeverity, string> = {
  high:   "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low:    "bg-blue-50 text-blue-700",
};

type Filters = {
  search:   string;
  status:   OperationStatus | "all";
  entity:   string;
  type:     OperationType | "all";
  severity: OperationSeverity | "all";
};

const DEFAULT_FILTERS: Filters = {
  search: "", status: "all", entity: "all", type: "all", severity: "all",
};

export function OperationsInbox({ items }: { items: OperationItem[] }) {
  const [statuses, setStatuses] = useState<Record<string, OperationStatus>>({});
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setStatuses(JSON.parse(raw));
    } catch {}
  }, []);

  const getStatus = (id: string): OperationStatus => statuses[id] ?? "new";

  const setStatus = (id: string, status: OperationStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [id]: status };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    if (status === "resolved") {
      setToastMsg("Marked as Resolved");
      setTimeout(() => setToastMsg(null), 2000);
    }
  };

  // Derived filter options
  const entities = useMemo(() =>
    [...new Set(items.map((i) => i.entity))].sort(), [items]);
  const types = useMemo(() =>
    [...new Set(items.map((i) => i.type))] as OperationType[], [items]);

  // Filtered + sorted items
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const status = getStatus(item.id);
      if (filters.status !== "all" && status !== filters.status) return false;
      if (filters.entity !== "all" && item.entity !== filters.entity) return false;
      if (filters.type   !== "all" && item.type   !== filters.type)   return false;
      if (filters.severity !== "all" && item.severity !== filters.severity) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) &&
            !item.description.toLowerCase().includes(q) &&
            !item.entity.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters, statuses]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedStatus = selected ? getStatus(selected.id) : null;

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== "search" && v !== "all"
  ).length + (filters.search ? 1 : 0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { new: 0, acknowledged: 0, in_progress: 0, resolved: 0 };
    items.forEach((i) => { c[getStatus(i.id)] = (c[getStatus(i.id)] ?? 0) + 1; });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, statuses]);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Filter Rail ───────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-700">Filters</span>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Clear {activeFilterCount}
            </button>
          )}
        </div>

        <div className="flex-1 px-3 py-3 space-y-4">

          {/* Status */}
          <FilterSection label="Status">
            <FilterOption
              label="All"
              count={items.length}
              active={filters.status === "all"}
              onClick={() => setFilters((f) => ({ ...f, status: "all" }))}
            />
            {(["new", "acknowledged", "in_progress", "resolved"] as OperationStatus[]).map((s) => (
              <FilterOption
                key={s}
                label={STATUS_LABEL[s]}
                count={counts[s] ?? 0}
                active={filters.status === s}
                dot={STATUS_STYLE[s].dot}
                onClick={() => setFilters((f) => ({ ...f, status: f.status === s ? "all" : s }))}
              />
            ))}
          </FilterSection>

          {/* Severity */}
          <FilterSection label="Severity">
            <FilterOption label="All" active={filters.severity === "all"} onClick={() => setFilters((f) => ({ ...f, severity: "all" }))} />
            {(["high", "medium", "low"] as OperationSeverity[]).map((s) => (
              <FilterOption
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                active={filters.severity === s}
                dot={`bg-[${SEV_COLOR[s]}]`}
                dotColor={SEV_COLOR[s]}
                onClick={() => setFilters((f) => ({ ...f, severity: f.severity === s ? "all" : s }))}
              />
            ))}
          </FilterSection>

          {/* Entity */}
          <FilterSection label="Entity">
            <FilterOption label="All entities" active={filters.entity === "all"} onClick={() => setFilters((f) => ({ ...f, entity: "all" }))} />
            {entities.map((e) => (
              <FilterOption
                key={e}
                label={e}
                active={filters.entity === e}
                onClick={() => setFilters((f) => ({ ...f, entity: f.entity === e ? "all" : e }))}
              />
            ))}
          </FilterSection>

          {/* Type */}
          <FilterSection label="Type">
            <FilterOption label="All types" active={filters.type === "all"} onClick={() => setFilters((f) => ({ ...f, type: "all" }))} />
            {types.map((t) => (
              <FilterOption
                key={t}
                label={TYPE_LABEL[t]}
                active={filters.type === t}
                onClick={() => setFilters((f) => ({ ...f, type: f.type === t ? "all" : t }))}
              />
            ))}
          </FilterSection>
        </div>
      </aside>

      {/* ── Priority List ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* List header + search */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search items…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="flex-1 text-[12px] bg-transparent outline-none text-gray-800 placeholder-gray-400"
              />
              {filters.search && (
                <button onClick={() => setFilters((f) => ({ ...f, search: "" }))}>
                  <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {filtered.length} of {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Inbox className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-[13px] font-medium text-gray-400">No items match your filters</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-2 text-[11px] text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <motion.div
              className="divide-y divide-gray-100"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              {filtered.map((item) => {
                const status = getStatus(item.id);
                const ss = STATUS_STYLE[status];
                const isSelected = item.id === selectedId;
                const isResolved = status === "resolved";
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                      isSelected ? "bg-emerald-50 border-l-2 border-emerald-500" : "hover:bg-gray-50 border-l-2 border-transparent"
                    } ${isResolved ? "opacity-50" : ""}`}
                    variants={reduced ? undefined : {
                      hidden: { opacity: 0, x: -6 },
                      show:   { opacity: 1, x: 0, transition: { duration: 0.18, ease } },
                    }}
                  >
                    {/* Severity indicator */}
                    <div className="flex-shrink-0 mt-0.5">
                      <SeverityIcon severity={item.severity} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-[12px] font-semibold leading-tight ${isResolved ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {item.title}
                        </p>
                        {isSelected && <ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug mb-1.5 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Entity dot */}
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: item.entityColor }}
                        />
                        <span className="text-[10px] text-gray-400">{item.entity}</span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${SEV_BG[item.severity]}`}>
                          {item.severity.toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                          <span className={`inline-block w-1 h-1 rounded-full ${ss.dot} mr-1`} />
                          {STATUS_LABEL[status]}
                        </span>
                        {item.amount && (
                          <>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-500 font-medium">{
                              item.amount >= 1000 ? `$${Math.round(item.amount / 1000)}K` : `$${Math.round(item.amount)}`
                            }</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Detail Panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
      {selected && (
      <motion.aside
        className="flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto flex flex-col w-[340px]"
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced    ? { opacity: 0 } : { opacity: 0, x: 20 }}
        transition={{ duration: 0.2, ease }}
      >
        {selected && selectedStatus && (
          <>
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] font-semibold text-gray-600">Item Detail</span>
              <button
                onClick={() => setSelectedId(null)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">

              {/* Entity + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{ background: `${selected.entityColor}1A`, color: selected.entityColor }}
                >
                  {selected.entity}
                </span>
                <span className={`text-[9px] font-semibold px-2 py-1 rounded-full ${SEV_BG[selected.severity]}`}>
                  {selected.severity.toUpperCase()}
                </span>
                <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {TYPE_LABEL[selected.type]}
                </span>
              </div>

              {/* Title */}
              <div>
                <h2 className="text-[14px] font-bold text-gray-900 leading-snug">{selected.title}</h2>
                {selected.amount && (
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Amount affected: <span className="font-semibold text-gray-800">
                      {selected.amount >= 1000 ? `$${Math.round(selected.amount / 1000)}K` : `$${Math.round(selected.amount)}`}
                    </span>
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">Flagged {selected.flaggedDate}</p>
              </div>

              {/* Description */}
              <p className="text-[12px] text-gray-600 leading-relaxed">{selected.description}</p>

              {/* Details */}
              {selected.details.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Details & Actions</p>
                  {selected.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-1.5" />
                      <p className="text-[11px] text-gray-700 leading-relaxed">{d}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Status lifecycle */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Status</p>
                <div className="flex items-center gap-1.5 mb-3">
                  {STATUS_ORDER.map((s, i) => {
                    const idx = STATUS_ORDER.indexOf(selectedStatus);
                    const done  = STATUS_ORDER.indexOf(s) <= idx;
                    const ss    = STATUS_STYLE[s];
                    return (
                      <div key={s} className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold transition-colors ${
                          done ? `${ss.bg} ${ss.text}` : "bg-gray-100 text-gray-300"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${done ? ss.dot : "bg-gray-300"}`} />
                          {STATUS_LABEL[s]}
                        </div>
                        {i < STATUS_ORDER.length - 1 && (
                          <span className={`text-[10px] ${done && STATUS_ORDER.indexOf(STATUS_ORDER[i+1]) <= idx ? "text-gray-400" : "text-gray-200"}`}>→</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Transition buttons */}
                <div className="flex gap-2">
                  {selectedStatus !== "resolved" && (() => {
                    const nextIdx = STATUS_ORDER.indexOf(selectedStatus) + 1;
                    const next = STATUS_ORDER[nextIdx];
                    return (
                      <button
                        onClick={() => setStatus(selected.id, next)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Mark as {STATUS_LABEL[next]}
                      </button>
                    );
                  })()}
                  {selectedStatus !== "new" && (
                    <button
                      onClick={() => setStatus(selected.id, "new")}
                      className="px-3 py-2 border border-gray-200 text-gray-500 text-[11px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Action link */}
              <Link
                href={selected.href}
                className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div>
                  <p className="text-[12px] font-semibold text-gray-800">{selected.action}</p>
                  <p className="text-[10px] text-gray-400">Open {selected.entity} {selected.href.split("/").pop()}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </Link>
            </div>
          </>
        )}
      </motion.aside>
      )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg bg-emerald-600 text-white text-[13px] font-semibold"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced    ? { opacity: 0 } : { opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.2, ease }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: OperationSeverity }) {
  if (severity === "high")   return <AlertCircle   className="w-4 h-4" style={{ color: "#EF4444" }} />;
  if (severity === "medium") return <AlertTriangle className="w-4 h-4" style={{ color: "#F59E0B" }} />;
  return                            <Info           className="w-4 h-4" style={{ color: "#3B82F6" }} />;
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterOption({
  label, count, active, dot, dotColor, onClick,
}: {
  label: string; count?: number; active: boolean;
  dot?: string; dotColor?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
        active ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
      }`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={dotColor ? { background: dotColor } : undefined}
        />
      )}
      <span className={`text-[11px] font-medium flex-1 truncate ${active ? "text-emerald-700" : ""}`}>
        {label}
      </span>
      {count !== undefined && (
        <span className={`text-[10px] font-semibold ${active ? "text-emerald-600" : "text-gray-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

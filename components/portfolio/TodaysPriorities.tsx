"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import type { PriorityItem } from "@/lib/briefing";

type Status = "new" | "acknowledged" | "in_progress" | "resolved";
const LS_KEY = "financeos_op_statuses";

const STATUS_ORDER: Status[] = ["new", "acknowledged", "in_progress", "resolved"];
const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const STATUS_STYLE: Record<Status, { bg: string; text: string }> = {
  new:          { bg: "bg-red-50",    text: "text-red-700" },
  acknowledged: { bg: "bg-amber-50",  text: "text-amber-700" },
  in_progress:  { bg: "bg-blue-50",   text: "text-blue-700" },
  resolved:     { bg: "bg-gray-100",  text: "text-gray-400" },
};
const SEV_STYLE: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-400",
  low:    "bg-blue-400",
};

export function TodaysPriorities({ priorities }: { priorities: PriorityItem[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setStatuses(JSON.parse(raw));
    } catch {}
  }, []);

  const getStatus = (id: string): Status => statuses[id] ?? "new";

  const advance = (id: string) => {
    setStatuses((prev) => {
      const cur = prev[id] ?? "new";
      const nextIdx = Math.min(STATUS_ORDER.indexOf(cur) + 1, STATUS_ORDER.length - 1);
      const next = { ...prev, [id]: STATUS_ORDER[nextIdx] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const active = priorities.filter((p) => getStatus(p.id) !== "resolved");
  const resolved = priorities.filter((p) => getStatus(p.id) === "resolved");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900">Today&apos;s Priorities</h2>
          {active.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {active.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">
          {resolved.length}/{priorities.length} resolved
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {active.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-gray-400 text-center">
            All priorities resolved — great work!
          </p>
        )}
        {active.map((item) => {
          const status = getStatus(item.id);
          const ss = STATUS_STYLE[status];
          const isResolved = status === "resolved";
          return (
            <div
              key={item.id}
              className={`px-4 py-3 flex items-start gap-3 ${isResolved ? "opacity-40" : ""}`}
            >
              {/* Severity dot */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                <span className={`w-2 h-2 rounded-full ${SEV_STYLE[item.severity]}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="inline-block w-1.5 h-4 rounded-sm flex-shrink-0"
                    style={{ background: item.entityColor }}
                  />
                  <p className="text-[12px] font-semibold text-gray-900 truncate">{item.title}</p>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed ml-3.5">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5 ml-3.5">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <Link
                    href={item.href}
                    className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                  >
                    {item.action}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Advance button */}
              {status !== "resolved" && (
                <button
                  onClick={() => advance(item.id)}
                  className="flex-shrink-0 text-[10px] font-medium text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors mt-0.5"
                >
                  {STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]
                    ? `→ ${STATUS_LABEL[STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]]}`
                    : "Resolved"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolved toggle */}
      {resolved.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-gray-400 hover:bg-gray-50 transition-colors"
          >
            <span>{resolved.length} resolved item{resolved.length !== 1 ? "s" : ""}</span>
            {showResolved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showResolved && (
            <div className="divide-y divide-gray-50 opacity-40">
              {resolved.map((item) => (
                <div key={item.id} className="px-4 py-2 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <p className="text-[11px] text-gray-500 truncate line-through">{item.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

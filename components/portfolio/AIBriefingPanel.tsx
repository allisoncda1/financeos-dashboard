"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Zap, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { BriefingData } from "@/lib/briefing";

const LS_KEY = "financeos_briefing_collapsed";

export function AIBriefingPanel({ briefing }: { briefing: BriefingData }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <aside
      className="flex-shrink-0 flex flex-col bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden"
      style={{ width: collapsed ? 52 : 264 }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-gray-800 truncate">AI Briefing</span>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggle}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={toggle}
            className="sr-only"
            aria-label="Expand AI Briefing"
          />
        )}
      </div>

      {/* ── Collapsed toggle ─────────────────────────────── */}
      {collapsed && (
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ── Content ─────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

          {/* Greeting */}
          <div>
            <p className="text-[13px] font-semibold text-gray-900">
              {briefing.greeting}, {briefing.userName}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{briefing.date}</p>
          </div>

          {/* Data freshness */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-50">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: briefing.pipelineHealthy ? "#10B981" : "#EF4444" }}
            />
            <span className="text-[10px] text-emerald-700 font-medium">
              Data as of {briefing.lastUpdated} · {briefing.confidenceScore}% confidence
            </span>
          </div>

          {/* Summary bullets */}
          <div>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Portfolio Summary
            </p>
            <div className="space-y-1.5">
              {briefing.summaryItems.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <SummaryIcon type={item.type} />
                  <p className="text-[11px] leading-relaxed" style={{ color: summaryTextColor(item.type) }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended actions */}
          {briefing.recommendedActions.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Recommended Actions
              </p>
              <div className="space-y-1">
                {briefing.recommendedActions.map((action) => (
                  <Link
                    key={action.index}
                    href={action.href}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                      {action.index}
                    </span>
                    <span className="text-[11px] text-gray-700 group-hover:text-gray-900 leading-tight flex-1">
                      {action.text}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-gray-100 flex-shrink-0">
          <p className="text-[9px] text-gray-300 text-center">
            Generated from live portfolio data
          </p>
        </div>
      )}
    </aside>
  );
}

function SummaryIcon({ type }: { type: "positive" | "negative" | "neutral" }) {
  if (type === "positive")
    return <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#10B981" }} />;
  if (type === "negative")
    return <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />;
  return <Circle className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-300" />;
}

function summaryTextColor(type: "positive" | "negative" | "neutral") {
  if (type === "positive") return "#065F46";
  if (type === "negative") return "#991B1B";
  return "#374151";
}

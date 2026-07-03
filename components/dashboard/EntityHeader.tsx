"use client";

import { CalendarDays, Share2, Download, ChevronDown } from "lucide-react";
import { ENTITY_META } from "@/lib/entities";
import type { EntitySlug } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";

type Props = {
  entityName: string;
  entityColor: string;
  asOf: string;
  slug?: EntitySlug;
};

export function EntityHeader({ entityName, entityColor, asOf, slug }: Props) {
  const [month] = formatAsOf(asOf);
  const meta = slug ? ENTITY_META[slug] : null;

  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-4 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Entity logo */}
        {meta && (
          <div
            className="rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
            style={{ width: 48, height: 48, background: `${meta.color}12`, border: `1.5px solid ${meta.color}28` }}
          >
            <EntityLogo entity={meta} size={40} rounded="lg" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold text-gray-900 leading-tight">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {"Here's what's happening with "}
            <span className="font-semibold" style={{ color: entityColor }}>{entityName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1 flex-shrink-0">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
          <span>{month} 2026</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
        </button>
        <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
          <Share2 className="w-3.5 h-3.5 text-gray-400" />
          <span>Share</span>
        </button>
        <button
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: entityColor || "#16A34A" }}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    </div>
  );
}

function formatAsOf(asOf: string): [string, string] {
  try {
    const d = new Date(asOf);
    return [d.toLocaleString("en-US", { month: "long" }), d.getFullYear().toString()];
  } catch {
    return ["June", "2026"];
  }
}

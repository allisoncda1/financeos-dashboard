
import Link from "@/lib/next-compat";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";
import type { EntitySlug, EntityMetrics } from "@/lib/types";
import { ENTITY_META } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";
import { computeHealthScore, healthLabel, generateEntityInsight } from "@/lib/briefing";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

type Props = { slug: EntitySlug; metrics: EntityMetrics; validationPassed: boolean };

export function EntityCard({ slug, metrics: m, validationPassed }: Props) {
  const meta   = ENTITY_META[slug];
  const score  = computeHealthScore(m);
  const label  = healthLabel(score);
  const insight = generateEntityInsight(m);

  const insightBg   = insight.type === "positive" ? "bg-emerald-50"  : insight.type === "critical" ? "bg-red-50"   : "bg-amber-50";
  const insightText = insight.type === "positive" ? "text-emerald-700": insight.type === "critical" ? "text-red-700": "text-amber-700";
  const scoreColor  = score >= 85 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/entity/${slug}`}
        className="block bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors group overflow-hidden"
        style={{ borderLeft: `3px solid ${meta.color}` }}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <EntityLogo entity={meta} size={32} rounded="lg" />
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-gray-900 truncate">{meta.name}</h3>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${meta.color}18`, color: meta.color }}
              >
                {meta.basis}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[18px] font-bold leading-tight" style={{ color: scoreColor }}>{score}</div>
            <div className="text-[9px] font-medium" style={{ color: scoreColor }}>{label}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="px-4 pb-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <KpiRow label="Revenue YTD"  value={fmt(m.revenue_ytd)} />
          <KpiRow label="Net Income"   value={fmt(m.net_income_ytd)} />
          <KpiRow label="Cash"         value={fmt(m.cash_on_hand)} />
          <KpiRow label="Open AR"      value={fmt(m.open_ar)} />
          <KpiRow label="DSO"          value={`${m.dso_days}d`}             warn={m.dso_days > 60} />
          <KpiRow label="AR Overdue"   value={`${m.ar_overdue_pct.toFixed(1)}%`} warn={m.ar_overdue_pct > 10} />
        </div>

        {/* Insight */}
        <div className={`mx-3 mb-3 px-2.5 py-1.5 rounded-lg ${insightBg}`}>
          <p className={`text-[10px] font-medium ${insightText}`}>{insight.text}</p>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {validationPassed
              ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              : <AlertCircle  className="w-3 h-3 text-red-500" />}
            <span className="text-[9px] text-gray-400">
              {validationPassed ? "40/40 checks passed" : "Validation issues"}
            </span>
          </div>
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium group-hover:text-emerald-700 transition-colors">
            Open entity <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function KpiRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[10px] font-semibold ${warn ? "text-red-600" : "text-gray-800"}`}>{value}</span>
    </div>
  );
}

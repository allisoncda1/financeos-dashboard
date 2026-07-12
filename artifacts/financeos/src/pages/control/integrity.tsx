import { useDashboardData } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG } from "@/lib/entities";
import { ShieldCheck, CheckCircle2, AlertCircle, Database, RefreshCw, HardDrive, Archive, History } from "lucide-react";

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function statusStyle(s: string | boolean) {
  const pass = s === "complete" || s === "healthy" || s === true || s === "success";
  const warn = s === "warning";
  if (pass) return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: s === true ? "Yes" : String(s) };
  if (warn) return { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400",  label: "Warning" };
  if (s === "not_applicable") return { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-300", label: "Not applicable" };
  return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: s === false ? "No" : String(s) };
}

export default function IntegrityPage() {
  const { data, source } = useDashboardData();
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }
  const f = data.freshness;
  const v = data.validation;

  // Overall confidence derived from the real validation pass rate only.
  const passPct = v.total_checks > 0 ? v.passed / v.total_checks : 0;
  const confidence = Math.round(passPct * 100);
  const avgDuration = f.avg_entity_sync_duration_seconds == null
    ? "—"
    : `${f.avg_entity_sync_duration_seconds.toFixed(1)}s`;
  const uptime = f.pipeline_uptime_30d_pct == null
    ? "—"
    : `${f.pipeline_uptime_30d_pct.toFixed(1)}% (${f.successful_runs_30d ?? 0}/${f.total_runs_30d ?? 0})`;

  const entityFreshness = ENTITY_SLUGS.map((slug) => {
    const m = data.metrics[slug];
    const cfg = ENTITY_CONFIG[slug];
    const health = m.health_score;
    return { slug, cfg, m, health };
  });

  const PIPELINE_STEPS = [
    { label: "QBO Connection",       icon: Database,  value: f.qbo_connection,         key: "qbo" },
    { label: "Extraction",   icon: RefreshCw, value: f.phase2_extraction,       key: "ext" },
    { label: "Model Build",          icon: HardDrive, value: f.model_build,             key: "build" },
    { label: "Drive Upload",         icon: Archive,   value: f.drive_upload,            key: "drive" },
    { label: "Snapshot Archived",    icon: Archive,   value: f.snapshot_archived,       key: "snap" },
    { label: "Model History",        icon: History,   value: f.model_history_archived,  key: "hist" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Integrity Center</h1>
            <p className="text-[11px] text-gray-400">Pipeline health · data freshness · last run {fmtTs(f.pipeline_run)}</p>
          </div>
        </div>
        {/* Confidence badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Confidence Score</p>
            <p className="text-[22px] font-black text-emerald-600">{confidence}<span className="text-[13px] font-semibold text-emerald-400">/100</span></p>
          </div>
          <ConfidenceArc score={confidence} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">

        {/* Pipeline status strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STEPS.map(({ label, icon: Icon, value }) => {
            const ss = statusStyle(value as string | boolean);
            return (
              <div key={label} className={`rounded-xl border p-4 flex flex-col gap-2 ${ss.bg} border-transparent`}>
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className={`w-2 h-2 rounded-full ${ss.dot}`} />
                </div>
                <p className="text-[10px] font-semibold text-gray-500 leading-snug">{label}</p>
                <p className={`text-[11px] font-bold capitalize ${ss.text}`}>{ss.label}</p>
              </div>
            );
          })}
        </div>

        {/* Pipeline health + validation summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-4">Pipeline Health</h3>
            <div className="space-y-3">
              {[
                { label: "Last successful run",  value: fmtTs(f.pipeline_run) },
                { label: "Data as of",           value: f.data_as_of },
                { label: "Entities processed",   value: `${f.entities_built} / 4` },
                { label: "Latest trigger",       value: f.latest_trigger ?? "—" },
                { label: "Avg entity sync duration (30d)", value: avgDuration },
                { label: "Pipeline success rate (30d)", value: uptime },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">{r.label}</span>
                  <span className="text-[12px] font-semibold text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-4">Validation Summary</h3>
            {/* Pass/fail ring */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#10B981" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - passPct)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-emerald-600">{v.passed}/{v.total_checks}</span>
                </div>
              </div>
              <div>
                <p className="text-[20px] font-black text-gray-900">{Math.round(passPct * 100)}%</p>
                <p className="text-[11px] text-gray-500">checks passed</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{v.rule_count} rules × {v.entity_count} entities</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Total checks",  value: v.total_checks },
                { label: "Passed",        value: v.passed,         color: "text-emerald-600" },
                { label: "Failed",        value: v.failed,         color: "text-red-600" },
                { label: "Run date",      value: v.run_date },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">{r.label}</span>
                  <span className={`text-[12px] font-semibold ${r.color ?? "text-gray-800"}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data freshness by entity */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Data Freshness by Entity</h3>
            <p className="text-[11px] text-gray-400">All entities current as of {data.portfolio.as_of}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Entity", "Basis", "As Of", "Pipeline Run", "Health Score", "Anomalies", "Status"].map((h) => (
                  <th key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entityFreshness.map(({ slug, cfg, m, health }) => {
                const anomalyCount = data.anomalies[slug].length;
                return (
                  <tr key={slug} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                      <span className="text-[12px] font-semibold text-gray-900">{cfg.name}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{cfg.basis}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-700 font-medium">{m.as_of}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{fmtTs(m.pipeline_run)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        health >= 80 ? "bg-emerald-50 text-emerald-700" : health >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      }`}>{health}</span>
                    </td>
                    <td className="px-4 py-3">
                      {anomalyCount > 0
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />{anomalyCount}
                          </span>
                        : <span className="text-[11px] text-gray-400">None</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Current
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ── SVG confidence arc ─────────────────────────────────────────────────────
function ConfidenceArc({ score }: { score: number }) {
  const r = 28, cx = 32, cy = 32;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° arc
  const fill = arc * (score / 100);
  const color = score >= 90 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth="6"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
        style={{ transformOrigin: "32px 32px", transform: "rotate(135deg)" }} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transformOrigin: "32px 32px", transform: "rotate(135deg)" }} />
    </svg>
  );
}

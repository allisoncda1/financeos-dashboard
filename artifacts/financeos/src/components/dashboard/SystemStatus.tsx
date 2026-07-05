import type { DataSourceState } from "@/lib/dataState";
import type { PipelineStatus } from "@/lib/pipelineTypes";

// System Status — technical / audit information moved out of prime dashboard
// space. Everything here is bound to real pipeline + validation data. This is
// where "Data Integrity" (validation pass-rate) now lives, alongside pipeline,
// source, refresh, financial basis and model build metadata.
type Props = {
  validation: { passed: number | null; totalChecks: number | null; allPassed: boolean | null };
  pipeline: PipelineStatus | null;
  basis: "Cash" | "Accrual";
  asOf: string;
  pipelineRun: string;
  source: DataSourceState;
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const SOURCE_META: Record<DataSourceState, { text: string; cls: string; ok: boolean }> = {
  db: { text: "Live DB", cls: "bg-emerald-100 text-emerald-700", ok: true },
  live: { text: "Live", cls: "bg-emerald-100 text-emerald-700", ok: true },
  cache: { text: "Cached", cls: "bg-blue-100 text-blue-700", ok: true },
  mock: { text: "Sample", cls: "bg-amber-100 text-amber-800", ok: false },
  loading: { text: "Loading…", cls: "bg-gray-100 text-gray-500", ok: false },
  unavailable: { text: "Unavailable", cls: "bg-red-100 text-red-700", ok: false },
};

export function SystemStatus({ validation, pipeline, basis, asOf, pipelineRun, source }: Props) {
  const hasValidation = validation.totalChecks != null && validation.totalChecks > 0 && validation.passed != null;
  const passPct = hasValidation ? Math.round((validation.passed! / validation.totalChecks!) * 100) : null;
  const integrityColor = passPct === null ? "#9CA3AF" : validation.allPassed ? "#10B981" : passPct >= 80 ? "#F59E0B" : "#EF4444";

  const sourceMeta = SOURCE_META[source];
  const modelBuild = pipeline?.modelBuild ?? "unknown";
  const modelBuildOk = modelBuild === "complete" || modelBuild === "success";
  const staleOk = pipeline?.staleStatus === "fresh";
  const lastRun = pipeline?.lastPipelineRun ?? pipelineRun;

  const fields: { label: string; value: string; dot?: boolean }[] = [
    { label: "Pipeline", value: pipeline?.staleStatus ?? "unknown", dot: staleOk },
    { label: "Model Build", value: modelBuild, dot: modelBuildOk },
    { label: "Last Refresh", value: fmtDateTime(lastRun) },
    { label: "Data As Of", value: asOf },
    { label: "Financial Basis", value: basis },
    { label: "Snapshot Built", value: fmtDateTime(pipelineRun) },
    { label: "QBO Connection", value: pipeline?.qboConnection ?? "unknown", dot: pipeline?.qboConnection === "healthy" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">System Status</p>

      <div className="flex flex-wrap items-stretch gap-4">
        {/* Data Integrity — validation pass-rate (audit trust indicator) */}
        <div className="flex items-center gap-3 pr-4 border-r border-gray-100">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border: `3px solid ${integrityColor}` }}
          >
            <span className="text-[13px] font-bold" style={{ color: integrityColor }}>
              {passPct === null ? "—" : `${passPct}%`}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-800">Data Integrity</p>
            <p className="text-[10px] text-gray-500">
              {hasValidation ? `${validation.passed}/${validation.totalChecks} checks passed` : "Not reported"}
            </p>
          </div>
        </div>

        {/* Source pill */}
        <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Data Source</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mt-0.5 ${sourceMeta.cls}`}>
              {sourceMeta.text}
            </span>
          </div>
        </div>

        {/* Technical grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 min-w-0">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{f.label}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {f.dot !== undefined && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.dot ? "#10B981" : "#EF4444" }} />
                )}
                <span className="text-[11px] font-medium text-gray-700 truncate">{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

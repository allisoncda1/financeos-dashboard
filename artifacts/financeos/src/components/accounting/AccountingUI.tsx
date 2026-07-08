import type { ReactNode } from "react";

export function Card({ title, action, children, className = "" }: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          {title && <h2 className="text-[14px] font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
  indigo: "bg-indigo-50 text-indigo-700",
  orange: "bg-orange-50 text-orange-700",
  rose: "bg-rose-50 text-rose-700",
};

export function Pill({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${PILL_TONES[tone] ?? PILL_TONES.gray}`}>
      {children}
    </span>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-left ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[12px] text-gray-600 ${className}`}>{children}</td>;
}

export function DataTable({ headers, children }: { headers: { label: string; className?: string }[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {headers.map((h, i) => (
              <Th key={i} className={h.className}>{h.label}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function PrimaryButton({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <button
      data-testid={testId}
      className="flex items-center gap-2 px-4 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors text-[12px] font-semibold"
    >
      {children}
    </button>
  );
}

export function MiniKpi({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: string }) {
  const toneText: Record<string, string> = {
    gray: "text-gray-900",
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className={`text-[22px] font-bold leading-tight ${toneText[tone] ?? toneText.gray}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

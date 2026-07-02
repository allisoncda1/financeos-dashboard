import { CalendarDays, Share2, Download, ChevronDown } from "lucide-react";

type Props = {
  entityName: string;
  entityColor: string;
  asOf: string;
};

export function EntityHeader({ entityName, entityColor, asOf }: Props) {
  const [month, year] = formatAsOf(asOf);

  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-4">
      <div>
        <h1 className="text-[26px] font-bold text-gray-900 leading-tight">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {"Here's what's happening with "}
          <span className="font-semibold" style={{ color: entityColor }}>
            {entityName}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 mt-1">
        {/* Date picker */}
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
          <span>{month} 2026</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
        </button>

        {/* Share */}
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
          <Share2 className="w-3.5 h-3.5 text-gray-400" />
          <span>Share</span>
        </button>

        {/* Export */}
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "#16A34A" }}>
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
    const month = d.toLocaleString("en-US", { month: "long" });
    const year = d.getFullYear().toString();
    return [month, year];
  } catch {
    return ["June", "2026"];
  }
}

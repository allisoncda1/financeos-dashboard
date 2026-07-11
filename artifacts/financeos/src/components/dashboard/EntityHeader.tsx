
import { Link } from "wouter";
import { FileText } from "lucide-react";
import { ENTITY_META } from "@/lib/entities";
import type { EntitySlug } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";

type Props = {
  entityName: string;
  entityColor: string;
  asOf?: string;
  slug?: EntitySlug;
};

export function EntityHeader({ entityName, entityColor, slug }: Props) {
  const meta = slug ? ENTITY_META[slug] : null;

  return (
    <div className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-4 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {meta && <EntityLogo entity={meta} size={48} rounded="xl" />}
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold text-gray-900 leading-tight">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {"Here's what's happening with "}
            <span className="font-semibold" style={{ color: entityColor }}>{entityName}</span>
          </p>
        </div>
      </div>

      {slug && (
        <div className="flex items-center gap-2 mt-1 flex-shrink-0">
          <Link
            href={`/entity/${slug}/reports`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: entityColor || "#16A34A" }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reports</span>
          </Link>
        </div>
      )}
    </div>
  );
}

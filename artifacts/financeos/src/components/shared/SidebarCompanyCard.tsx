import { ENTITY_META } from "@/lib/entities";
import type { EntitySlug } from "@/lib/types";
import { EntityLogo } from "@/components/ui/EntityLogo";

type Props = {
  /** Entity slug from the central registry — defaults to T3 Marketing */
  slug?: EntitySlug;
  label?: string;
};

/**
 * "Primary Company" card shown at the bottom of module sidebars.
 * Sources name and logo from the central entity registry (lib/entities.ts).
 */
export function SidebarCompanyCard({ slug = "T3_Marketing", label = "Primary Company" }: Props) {
  const entity = ENTITY_META[slug];
  return (
    <div className="px-3 mb-2">
      <div className="bg-white/5 rounded-lg p-2.5 flex items-center gap-2.5">
        <EntityLogo entity={entity} size={32} rounded="md" dark />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-white truncate">{entity.name}</p>
          <p className="text-[9px] text-white/40 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

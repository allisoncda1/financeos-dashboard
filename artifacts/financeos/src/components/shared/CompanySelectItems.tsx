import { SelectItem } from "@/components/ui/select";
import { ENTITY_META_LIST, PORTFOLIO_META } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";

type Props = {
  /** Include an "All Companies" option (value "all") at the top */
  includeAll?: boolean;
};

/**
 * Standardized company <SelectItem> list backed by the central entity
 * registry (lib/entities.ts). Values are entity slugs.
 * Use inside <SelectContent> so every module shows the same four
 * companies with the same names, order, and logos.
 */
export function CompanySelectItems({ includeAll = true }: Props) {
  return (
    <>
      {includeAll && (
        <SelectItem value="all">
          <span className="flex items-center gap-2">
            <EntityLogo entity={PORTFOLIO_META} size={16} rounded="sm" />
            All Companies
          </span>
        </SelectItem>
      )}
      {ENTITY_META_LIST.map(e => (
        <SelectItem key={e.slug} value={e.slug}>
          <span className="flex items-center gap-2">
            <EntityLogo entity={e} size={16} rounded="sm" />
            {e.name}
          </span>
        </SelectItem>
      ))}
    </>
  );
}

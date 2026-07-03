/**
 * Single source of truth for all entity display metadata.
 * Financial/data types remain in lib/types.ts — this covers UI concerns:
 * name, color, logo, initials, accounting basis, entity type.
 *
 * To add a logo: drop the PNG into public/logos/ with the filename
 * matching `logoFile` below, then the EntityLogo component picks it up
 * automatically. If the file is missing, EntityLogo falls back to initials.
 */

import type { EntitySlug } from "@/lib/types";
export type { EntitySlug } from "@/lib/types";
export { ENTITY_SLUGS } from "@/lib/types";

export type EntityType = "portfolio" | "agency" | "entity";

/** Shared shape for any logo-capable metadata (entities, portfolio, agency). */
export type LogoSource = {
  name: string;
  shortName: string;
  color: string;
  logoPath: string | null;   // null = use initials fallback
  initials: string;
};

/** Full entity metadata (real client entities). */
export type EntityMeta = LogoSource & {
  slug: EntitySlug;
  basis: "Cash" | "Accrual";
  type: "entity";
};

/** Virtual context — Portfolio (all 4 entities). */
export const PORTFOLIO_META: LogoSource & { slug: "portfolio"; type: "portfolio" } = {
  slug: "portfolio",
  name: "Portfolio",
  shortName: "All",
  color: "#10B981",
  logoPath: null,
  initials: "PF",
  type: "portfolio",
};

/** Virtual context — Agency only (T3, TopMrktr, Smile More). */
export const AGENCY_META: LogoSource & { slug: "agency"; type: "agency" } = {
  slug: "agency",
  name: "Agency only",
  shortName: "Agency",
  color: "#8B5CF6",
  logoPath: null,
  initials: "AG",
  type: "agency",
};

/**
 * Entity metadata keyed by EntitySlug.
 * logoPath → public/logos/<file>.png  (null = initials fallback)
 */
export const ENTITY_META: Record<EntitySlug, EntityMeta> = {
  CarDealer_ai: {
    slug: "CarDealer_ai",
    name: "CarDealer.ai",
    shortName: "CD.ai",
    basis: "Accrual",
    color: "#00d4b8",
    logoPath: "/logos/cardealer-ai.png",
    initials: "CD",
    type: "entity",
  },
  T3_Marketing: {
    slug: "T3_Marketing",
    name: "T3 Marketing",
    shortName: "T3",
    basis: "Cash",
    color: "#f59e0b",
    logoPath: "/logos/t3-marketing.png",
    initials: "T3",
    type: "entity",
  },
  TopMrktr: {
    slug: "TopMrktr",
    name: "TopMrktr",
    shortName: "TM",
    basis: "Accrual",
    color: "#8b5cf6",
    logoPath: "/logos/topmrktr.png",
    initials: "TM",
    type: "entity",
  },
  Smile_More: {
    slug: "Smile_More",
    name: "Smile More",
    shortName: "SM",
    basis: "Accrual",
    color: "#3b82f6",
    logoPath: "/logos/smile-more.png",
    initials: "SM",
    type: "entity",
  },
};

/** Ordered list of entity metas (same order as ENTITY_SLUGS). */
export const ENTITY_META_LIST: EntityMeta[] = [
  ENTITY_META.CarDealer_ai,
  ENTITY_META.T3_Marketing,
  ENTITY_META.TopMrktr,
  ENTITY_META.Smile_More,
];

/** Resolve logo source for any context (slug, "portfolio", or "agency"). */
export function resolveLogoSource(slug: EntitySlug | "portfolio" | "agency"): LogoSource {
  if (slug === "portfolio") return PORTFOLIO_META;
  if (slug === "agency") return AGENCY_META;
  return ENTITY_META[slug];
}

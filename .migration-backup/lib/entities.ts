/**
 * FinanceOS Entity Registry — Single Source of Truth
 *
 * Every company in the portfolio is defined exactly once here.
 * Components must never hardcode entity names, colors, slugs, or basis.
 * Always call getEntity(slug) or use ENTITY_REGISTRY.
 *
 * Phase 2 fields (quickbooksCompanyId, googleDriveFolder, etc.) are
 * defined as optional so they can be populated without code changes.
 */

// ─── Re-export primitives from types.ts for backward compat ──────────────────

export type { EntitySlug } from "@/lib/types";
export { ENTITY_SLUGS } from "@/lib/types";
import type { EntitySlug } from "@/lib/types";
import { ENTITY_SLUGS } from "@/lib/types";

// ─── Core entity definition ───────────────────────────────────────────────────

export interface EntityDefinition {
  /** URL-safe identifier — must match the slug in lib/types.ts */
  slug: EntitySlug;

  /** Full display name */
  displayName: string;
  /** Short name for tight spaces */
  shortName: string;

  /** Path under public/logos/ (null = initials fallback) */
  logo: string | null;
  /** Two-letter fallback shown when logo is missing */
  fallbackInitials: string;

  /** Brand color (hex) */
  primaryColor: string;
  /** Accent color for subtle tints — defaults to primaryColor if unused */
  accentColor: string;

  /** GAAP accounting method */
  accountingBasis: "Cash" | "Accrual";

  /** Classification for filtering */
  companyType: "Agency" | "Internal";

  /** Appears in the full portfolio view */
  includedInPortfolio: boolean;
  /** Appears in the agency-only view (excludes internal entities) */
  includedInAgencyView: boolean;
  /** Included in consolidated reports by default */
  includedInDefaultConsolidation: boolean;

  defaultCurrency: "USD";

  // ── Phase 2 placeholders (not used in Phase 1) ───────────────────────────
  /** QuickBooks Online company ID for live data pull */
  quickbooksCompanyId?: string;
  /** Google Drive shared folder ID */
  googleDriveFolder?: string;
  /** 08_DATA_MODEL subfolder path within Drive */
  dataModelFolder?: string;
  /** 09_MODEL_HISTORY subfolder path within Drive */
  historyFolder?: string;
  /** URL or path for default report cover logo */
  reportLogoUrl?: string;
  /** Notification badge / alert color (defaults to primaryColor) */
  notificationColor?: string;
  /** Current entity status */
  status?: "active" | "inactive" | "onboarding";

  /** Health score thresholds */
  healthThresholds: {
    green: number;
    amber: number;
    red: number;
  };
}

// ─── Virtual contexts (Portfolio, Agency) ────────────────────────────────────

/** Shared shape for anything that can be shown in the workspace switcher */
export type LogoSource = {
  name: string;
  shortName: string;
  color: string;
  logoPath: string | null;
  initials: string;
};

export type EntityType = "portfolio" | "agency" | "entity";

export type EntityMeta = LogoSource & {
  slug: EntitySlug;
  basis: "Cash" | "Accrual";
  type: "entity";
};

/** Virtual workspace context for "All 4 entities" */
export const PORTFOLIO_META: LogoSource & { slug: "portfolio"; type: "portfolio" } = {
  slug: "portfolio",
  name: "Portfolio",
  shortName: "All",
  color: "#10B981",
  logoPath: null,
  initials: "PF",
  type: "portfolio",
};

/** Virtual workspace context for "Agency only" */
export const AGENCY_META: LogoSource & { slug: "agency"; type: "agency" } = {
  slug: "agency",
  name: "Agency only",
  shortName: "Agency",
  color: "#8B5CF6",
  logoPath: null,
  initials: "AG",
  type: "agency",
};

// ─── The Registry ─────────────────────────────────────────────────────────────

const REGISTRY: EntityDefinition[] = [
  {
    slug: "CarDealer_ai",
    displayName: "CarDealer.ai",
    shortName: "CD.ai",
    logo: "/logos/cardealer-ai.png",
    fallbackInitials: "CD",
    primaryColor: "#00d4b8",
    accentColor: "#00d4b8",
    accountingBasis: "Accrual",
    companyType: "Internal",
    includedInPortfolio: true,
    includedInAgencyView: false,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    quickbooksCompanyId: undefined,
    googleDriveFolder: undefined,
    dataModelFolder: "08_DATA_MODEL/CarDealer_ai",
    historyFolder: "09_MODEL_HISTORY/CarDealer_ai",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
  {
    slug: "T3_Marketing",
    displayName: "T3 Marketing",
    shortName: "T3",
    logo: "/logos/t3-marketing.png",
    fallbackInitials: "T3",
    primaryColor: "#f59e0b",
    accentColor: "#f59e0b",
    accountingBasis: "Cash",
    companyType: "Agency",
    includedInPortfolio: true,
    includedInAgencyView: true,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    quickbooksCompanyId: undefined,
    googleDriveFolder: undefined,
    dataModelFolder: "08_DATA_MODEL/T3_Marketing",
    historyFolder: "09_MODEL_HISTORY/T3_Marketing",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
  {
    slug: "TopMrktr",
    displayName: "TopMrktr",
    shortName: "TM",
    logo: "/logos/topmrktr.png",
    fallbackInitials: "TM",
    primaryColor: "#8b5cf6",
    accentColor: "#8b5cf6",
    accountingBasis: "Accrual",
    companyType: "Agency",
    includedInPortfolio: true,
    includedInAgencyView: true,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    quickbooksCompanyId: undefined,
    googleDriveFolder: undefined,
    dataModelFolder: "08_DATA_MODEL/TopMrktr",
    historyFolder: "09_MODEL_HISTORY/TopMrktr",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
  {
    slug: "Smile_More",
    displayName: "Smile More",
    shortName: "SM",
    logo: "/logos/smile-more.png",
    fallbackInitials: "SM",
    primaryColor: "#3b82f6",
    accentColor: "#3b82f6",
    accountingBasis: "Accrual",
    companyType: "Agency",
    includedInPortfolio: true,
    includedInAgencyView: true,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    quickbooksCompanyId: undefined,
    googleDriveFolder: undefined,
    dataModelFolder: "08_DATA_MODEL/Smile_More",
    historyFolder: "09_MODEL_HISTORY/Smile_More",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
];

// ─── Index structures (built once at module init) ─────────────────────────────

const _bySlug = new Map<EntitySlug, EntityDefinition>(
  REGISTRY.map(e => [e.slug, e])
);

/** All entity definitions in registry order */
export const ENTITY_REGISTRY: readonly EntityDefinition[] = Object.freeze(REGISTRY);

/** Slugs of entities included in the portfolio view */
export const PORTFOLIO_SLUGS: EntitySlug[] = REGISTRY
  .filter(e => e.includedInPortfolio)
  .map(e => e.slug);

/** Slugs of entities included in agency-only view */
export const AGENCY_SLUGS: EntitySlug[] = REGISTRY
  .filter(e => e.includedInAgencyView)
  .map(e => e.slug);

/** Slugs of entities included in default consolidation */
export const DEFAULT_CONSOLIDATION_SLUGS: EntitySlug[] = REGISTRY
  .filter(e => e.includedInDefaultConsolidation)
  .map(e => e.slug);

// ─── Accessors ────────────────────────────────────────────────────────────────

/** Get entity definition by slug. Throws if slug is not registered. */
export function getEntity(slug: EntitySlug): EntityDefinition {
  const e = _bySlug.get(slug);
  if (!e) throw new Error(`[EntityRegistry] Unknown slug: "${slug}"`);
  return e;
}

/** Get entity definition by slug, returns null if not found (safe version). */
export function findEntity(slug: string): EntityDefinition | null {
  return _bySlug.get(slug as EntitySlug) ?? null;
}

/** Resolve a LogoSource from any context slug (entity, "portfolio", "agency") */
export function resolveLogoSource(slug: EntitySlug | "portfolio" | "agency"): LogoSource {
  if (slug === "portfolio") return PORTFOLIO_META;
  if (slug === "agency") return AGENCY_META;
  const e = getEntity(slug);
  return {
    name: e.displayName,
    shortName: e.shortName,
    color: e.primaryColor,
    logoPath: e.logo,
    initials: e.fallbackInitials,
  };
}

// ─── ENTITY_META: backward-compat Record<EntitySlug, EntityMeta> ─────────────

/** Keyed lookup compatible with the old ENTITY_CONFIG / ENTITY_META patterns */
export const ENTITY_META: Record<EntitySlug, EntityMeta> = Object.fromEntries(
  REGISTRY.map(e => [
    e.slug,
    {
      slug: e.slug,
      name: e.displayName,
      shortName: e.shortName,
      color: e.primaryColor,
      logoPath: e.logo,
      initials: e.fallbackInitials,
      basis: e.accountingBasis,
      type: "entity" as const,
    } satisfies EntityMeta,
  ])
) as Record<EntitySlug, EntityMeta>;

/** Ordered array of EntityMeta (same order as ENTITY_REGISTRY) */
export const ENTITY_META_LIST: EntityMeta[] = ENTITY_SLUGS.map(s => ENTITY_META[s]);

// ─── Legacy compatibility shim ────────────────────────────────────────────────
// Components that still import ENTITY_CONFIG from lib/types work fine,
// but new code should call getEntity(slug) instead.

/** @deprecated Use getEntity(slug) instead */
export const ENTITY_CONFIG: Record<EntitySlug, { name: string; basis: "Cash" | "Accrual"; color: string }> =
  Object.fromEntries(
    REGISTRY.map(e => [e.slug, { name: e.displayName, basis: e.accountingBasis, color: e.primaryColor }])
  ) as Record<EntitySlug, { name: string; basis: "Cash" | "Accrual"; color: string }>;

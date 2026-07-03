/**
 * Entity Registry — single source of truth for entity display metadata
 * (name, logo, brand color) used across the API (entities routes, Report
 * Engine branding, etc). Do not duplicate this data elsewhere; import from
 * here.
 */

import type { EntityDefinition } from "./types";

export const ENTITY_DEFINITIONS: EntityDefinition[] = [
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
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
  {
    slug: "Smile_More",
    displayName: "Smile More",
    shortName: "SM",
    logo: "/logos/smile-more.png",
    fallbackInitials: "SM",
    primaryColor: "#ec4899",
    accentColor: "#ec4899",
    accountingBasis: "Cash",
    companyType: "Internal",
    includedInPortfolio: true,
    includedInAgencyView: false,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
];

import { Router } from "express";
import type { EntityDefinition } from "../../shared/types.js";

const router = Router();

const ENTITY_REGISTRY: EntityDefinition[] = [
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
    primaryColor: "#3b82f6",
    accentColor: "#3b82f6",
    accountingBasis: "Accrual",
    companyType: "Agency",
    includedInPortfolio: true,
    includedInAgencyView: true,
    includedInDefaultConsolidation: true,
    defaultCurrency: "USD",
    status: "active",
    healthThresholds: { green: 85, amber: 70, red: 0 },
  },
];

// GET /api/entities — full registry
router.get("/", (_req, res) => {
  res.json({ ok: true, data: ENTITY_REGISTRY, ts: new Date().toISOString() });
});

// GET /api/entities/:slug — single entity
router.get("/:slug", (req, res) => {
  const entity = ENTITY_REGISTRY.find(e => e.slug === req.params.slug);
  if (!entity) {
    res.status(404).json({ ok: false, error: `Entity "${req.params.slug}" not found`, ts: new Date().toISOString() });
    return;
  }
  res.json({ ok: true, data: entity, ts: new Date().toISOString() });
});

export default router;

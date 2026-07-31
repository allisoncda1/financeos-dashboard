import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";

const LS_KEY_ENTITY = "financeos_commission_entity";
const LS_KEY_PERIOD = "financeos_commission_period";

function defaultPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function parsePeriod(p: string | null): { periodYear?: number; periodMonth?: number } {
  if (!p) return {};
  const [y, m] = p.split("-");
  const py = parseInt(y, 10);
  const pm = parseInt(m, 10);
  if (isNaN(py) || isNaN(pm)) return {};
  return { periodYear: py, periodMonth: pm };
}

type Ctx = {
  activeSlug: EntitySlug;
  setActiveSlug: (slug: EntitySlug) => void;
  activePeriod: string | null;
  setActivePeriod: (period: string | null) => void;
};

const CommissionEntityContext = createContext<Ctx>({
  activeSlug: ENTITY_SLUGS[0],
  setActiveSlug: () => {},
  activePeriod: defaultPeriod(),
  setActivePeriod: () => {},
});

export function CommissionEntityProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlugState] = useState<EntitySlug>(ENTITY_SLUGS[0]);
  const [activePeriod, setActivePeriodState] = useState<string | null>(defaultPeriod());

  useEffect(() => {
    try {
      const storedSlug = localStorage.getItem(LS_KEY_ENTITY) as EntitySlug | null;
      if (storedSlug && (ENTITY_SLUGS as readonly string[]).includes(storedSlug)) {
        setActiveSlugState(storedSlug);
      }
      const storedPeriod = localStorage.getItem(LS_KEY_PERIOD);
      if (storedPeriod === "all") {
        setActivePeriodState(null);
      } else if (storedPeriod && /^\d{4}-\d{2}$/.test(storedPeriod)) {
        setActivePeriodState(storedPeriod);
      }
    } catch {}
  }, []);

  const setActiveSlug = (slug: EntitySlug) => {
    setActiveSlugState(slug);
    try { localStorage.setItem(LS_KEY_ENTITY, slug); } catch {}
  };

  const setActivePeriod = (period: string | null) => {
    setActivePeriodState(period);
    try { localStorage.setItem(LS_KEY_PERIOD, period ?? "all"); } catch {}
  };

  return (
    <CommissionEntityContext.Provider value={{ activeSlug, setActiveSlug, activePeriod, setActivePeriod }}>
      {children}
    </CommissionEntityContext.Provider>
  );
}

export function useCommissionEntity() {
  return useContext(CommissionEntityContext);
}

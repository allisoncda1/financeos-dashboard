import { createContext, useContext, useState, type ReactNode } from "react";
import { ENTITY_SLUGS } from "@/lib/entities";
import type {
  AccountingBasis,
  AllocationScenarioId,
  AnalyticsEntityFilter,
} from "@/lib/analyticsTypes";

const LS_KEY = "financeos_analytics_filters";

type Ctx = {
  entity: AnalyticsEntityFilter;
  setEntity: (e: AnalyticsEntityFilter) => void;
  period: string;
  setPeriod: (p: string) => void;
  basis: AccountingBasis;
  setBasis: (b: AccountingBasis) => void;
  scenario: AllocationScenarioId;
  setScenario: (s: AllocationScenarioId) => void;
};

const AnalyticsContext = createContext<Ctx>({
  entity: "consolidated",
  setEntity: () => {},
  period: "fy26",
  setPeriod: () => {},
  basis: "accrual",
  setBasis: () => {},
  scenario: "approved-allocation",
  setScenario: () => {},
});

type Persisted = {
  entity?: AnalyticsEntityFilter;
  period?: string;
  basis?: AccountingBasis;
  scenario?: AllocationScenarioId;
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {}
  return {};
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted();

  const [entity, setEntityState] = useState<AnalyticsEntityFilter>(() => {
    const e = persisted.entity;
    if (e === "consolidated" || (e && (ENTITY_SLUGS as readonly string[]).includes(e))) return e;
    return "consolidated";
  });
  const [period, setPeriodState] = useState<string>(persisted.period ?? "fy26");
  const [basis, setBasisState] = useState<AccountingBasis>(persisted.basis ?? "accrual");
  const [scenario, setScenarioState] = useState<AllocationScenarioId>(
    persisted.scenario ?? "approved-allocation",
  );

  const persist = (patch: Persisted) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ entity, period, basis, scenario, ...patch }));
    } catch {}
  };

  const setEntity = (e: AnalyticsEntityFilter) => { setEntityState(e); persist({ entity: e }); };
  const setPeriod = (p: string) => { setPeriodState(p); persist({ period: p }); };
  const setBasis = (b: AccountingBasis) => { setBasisState(b); persist({ basis: b }); };
  const setScenario = (s: AllocationScenarioId) => { setScenarioState(s); persist({ scenario: s }); };

  return (
    <AnalyticsContext.Provider
      value={{ entity, setEntity, period, setPeriod, basis, setBasis, scenario, setScenario }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsFilters() {
  return useContext(AnalyticsContext);
}

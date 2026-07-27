import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { resolvePeriod, defaultPeriod, type PeriodFilter, type PeriodPreset } from "@/lib/period";

const LS_KEY = "financeos_accounting_period";

type Ctx = {
  activePeriod: PeriodFilter;
  setActivePeriod: (period: PeriodFilter) => void;
  setPreset: (preset: PeriodPreset) => void;
};

const AccountingPeriodContext = createContext<Ctx>({
  activePeriod: defaultPeriod(),
  setActivePeriod: () => {},
  setPreset: () => {},
});

export function AccountingPeriodProvider({ children }: { children: ReactNode }) {
  const [activePeriod, setActivePeriodState] = useState<PeriodFilter>(defaultPeriod);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          preset?: PeriodPreset;
          from?: string | null;
          to?: string | null;
        };
        if (parsed.preset) {
          setActivePeriodState(
            resolvePeriod(parsed.preset, { from: parsed.from ?? null, to: parsed.to ?? null }),
          );
        }
      }
    } catch {}
  }, []);

  const setActivePeriod = (period: PeriodFilter) => {
    setActivePeriodState(period);
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ preset: period.preset, from: period.from, to: period.to }),
      );
    } catch {}
  };

  const setPreset = (preset: PeriodPreset) => {
    // "custom" requires explicit from/to via setActivePeriod — do not auto-resolve
    if (preset === "custom") return;
    setActivePeriod(resolvePeriod(preset));
  };

  return (
    <AccountingPeriodContext.Provider value={{ activePeriod, setActivePeriod, setPreset }}>
      {children}
    </AccountingPeriodContext.Provider>
  );
}

export function useAccountingPeriod() {
  return useContext(AccountingPeriodContext);
}

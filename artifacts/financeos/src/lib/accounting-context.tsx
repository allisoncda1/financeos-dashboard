import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";

const LS_KEY = "financeos_accounting_entity";

type Ctx = {
  activeSlug: EntitySlug;
  setActiveSlug: (slug: EntitySlug) => void;
};

const AccountingEntityContext = createContext<Ctx>({
  activeSlug: ENTITY_SLUGS[0],
  setActiveSlug: () => {},
});

export function AccountingEntityProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlugState] = useState<EntitySlug>(ENTITY_SLUGS[0]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY) as EntitySlug | null;
      if (stored && (ENTITY_SLUGS as readonly string[]).includes(stored)) {
        setActiveSlugState(stored);
      }
    } catch {}
  }, []);

  const setActiveSlug = (slug: EntitySlug) => {
    setActiveSlugState(slug);
    try { localStorage.setItem(LS_KEY, slug); } catch {}
  };

  return (
    <AccountingEntityContext.Provider value={{ activeSlug, setActiveSlug }}>
      {children}
    </AccountingEntityContext.Provider>
  );
}

export function useAccountingEntity() {
  return useContext(AccountingEntityContext);
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";

const LS_KEY = "financeos_budget_entity";

type Ctx = {
  activeSlug: EntitySlug;
  setActiveSlug: (slug: EntitySlug) => void;
};

const BudgetEntityContext = createContext<Ctx>({
  activeSlug: ENTITY_SLUGS[0],
  setActiveSlug: () => {},
});

export function BudgetEntityProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlugState] = useState<EntitySlug>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY) as EntitySlug | null;
      if (stored && (ENTITY_SLUGS as readonly string[]).includes(stored)) return stored;
    } catch {}
    return ENTITY_SLUGS[0];
  });

  const setActiveSlug = (slug: EntitySlug) => {
    setActiveSlugState(slug);
    try { localStorage.setItem(LS_KEY, slug); } catch {}
  };

  return (
    <BudgetEntityContext.Provider value={{ activeSlug, setActiveSlug }}>
      {children}
    </BudgetEntityContext.Provider>
  );
}

export function useBudgetEntity() {
  return useContext(BudgetEntityContext);
}

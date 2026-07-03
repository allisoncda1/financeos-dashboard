"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ENTITY_SLUGS, AGENCY_SLUGS, type EntitySlug } from "@/lib/entities";

/** @deprecated Use AGENCY_SLUGS from lib/entities instead */
export const AGENCY_ENTITIES: EntitySlug[] = AGENCY_SLUGS;
export const ALL_ENTITIES: EntitySlug[] = [...ENTITY_SLUGS];

const LS_KEY = "financeos_entity_selection";

type Ctx = {
  selected: EntitySlug[];
  toggle: (slug: EntitySlug) => void;
  selectAll: () => void;
  setAgency: () => void;
  isSelected: (slug: EntitySlug) => boolean;
};

const EntitySelectionContext = createContext<Ctx>({
  selected: ALL_ENTITIES,
  toggle: () => {},
  selectAll: () => {},
  setAgency: () => {},
  isSelected: () => true,
});

export function EntitySelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<EntitySlug[]>(ALL_ENTITIES);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EntitySlug[];
        if (Array.isArray(parsed) && parsed.length > 0) setSelected(parsed);
      }
    } catch {}
  }, []);

  const save = (next: EntitySlug[]) => {
    if (next.length === 0) return; // never empty
    setSelected(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <EntitySelectionContext.Provider value={{
      selected,
      toggle: (slug) => save(
        selected.includes(slug)
          ? selected.length === 1 ? selected : selected.filter(s => s !== slug)
          : [...selected, slug]
      ),
      selectAll: () => save(ALL_ENTITIES),
      setAgency: () => save(AGENCY_SLUGS),
      isSelected: (slug) => selected.includes(slug),
    }}>
      {children}
    </EntitySelectionContext.Provider>
  );
}

export function useEntitySelection() {
  return useContext(EntitySelectionContext);
}

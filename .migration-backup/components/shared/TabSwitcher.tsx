"use client";

import { useState } from "react";

export type TabPanel = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export function TabSwitcher({ panels }: { panels: TabPanel[] }) {
  const [active, setActive] = useState(panels[0]?.id ?? "");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-gray-200 bg-white flex-shrink-0">
        {panels.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors -mb-px ${
              active === p.id
                ? "border-emerald-500 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Panels — all rendered, only active is visible */}
      <div className="flex-1 overflow-y-auto">
        {panels.map((p) => (
          <div key={p.id} style={{ display: p.id === active ? undefined : "none" }}>
            {p.content}
          </div>
        ))}
      </div>
    </div>
  );
}

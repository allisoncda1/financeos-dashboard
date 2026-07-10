import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";

type Props = {
  activeSlug: EntitySlug;
  onChange: (slug: EntitySlug) => void;
};

export function EntityPicker({ activeSlug, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ENTITY_SLUGS.map((slug) => {
        const cfg = ENTITY_CONFIG[slug];
        const isActive = slug === activeSlug;
        return (
          <button
            key={slug}
            onClick={() => onChange(slug)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors"
            style={{
              background: isActive ? `${cfg.color}18` : "transparent",
              color: isActive ? cfg.color : "#6B7280",
              border: `1px solid ${isActive ? cfg.color : "transparent"}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: cfg.color }}
            />
            {cfg.name}
          </button>
        );
      })}
    </div>
  );
}

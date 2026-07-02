import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EntitySlug } from "@/lib/types";
import { ENTITY_CONFIG } from "@/lib/types";

type Crumb = { label: string; href?: string };

type Props = {
  entitySlug: EntitySlug;
  pageTitle: string;
  asOf: string;
  extra?: React.ReactNode;
};

export function PageHeader({ entitySlug, pageTitle, asOf, extra }: Props) {
  const cfg = ENTITY_CONFIG[entitySlug];
  const crumbs: Crumb[] = [
    { label: "Portfolio", href: "/" },
    { label: cfg.name, href: `/entity/${entitySlug}` },
    { label: pageTitle },
  ];

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 mb-1.5">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            {c.href ? (
              <Link
                href={c.href}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {c.label}
              </Link>
            ) : (
              <span className="text-[11px] text-gray-600 font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-7 rounded-full flex-shrink-0"
            style={{ background: cfg.color }}
          />
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{pageTitle}</h1>
            <p className="text-[11px] text-gray-400">
              {cfg.name} · {cfg.basis} basis · As of {asOf}
            </p>
          </div>
        </div>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  );
}

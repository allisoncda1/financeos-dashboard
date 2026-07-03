import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  accentColor?: string;
};

export function TopBar({ title, subtitle, badge, accentColor }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 min-h-[64px]">
      <div className="flex items-center gap-3">
        {accentColor && (
          <div
            className="w-1 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </header>
  );
}

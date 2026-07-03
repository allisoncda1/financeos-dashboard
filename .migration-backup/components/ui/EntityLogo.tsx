"use client";

import { useState, useEffect } from "react";
import type { LogoSource } from "@/lib/entities";

type Rounded = "sm" | "md" | "lg" | "xl" | "full";

type Props = {
  entity: LogoSource;
  size?: number;
  /** Tailwind rounded variant — default "lg" */
  rounded?: Rounded;
  /** Extra wrapper classes */
  className?: string;
  /** Dark background mode (sidebar) */
  dark?: boolean;
};

/**
 * Renders an entity logo image. Falls back to a colored-initials avatar
 * automatically if the image is missing or fails to load.
 * Drop PNG files into public/logos/ matching the logoPath in lib/entities.ts.
 */
export function EntityLogo({ entity, size = 28, rounded = "lg", className = "", dark = false }: Props) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [entity.logoPath]);
  const showImg = !!entity.logoPath && !imgError;
  const roundedClass = `rounded-${rounded}`;

  if (showImg) {
    return (
      <div
        className={`overflow-hidden flex-shrink-0 flex items-center justify-center ${roundedClass} ${className}`}
        style={{
          width: size,
          height: size,
          background: dark ? "rgba(255,255,255,0.08)" : "#F9FAFB",
          padding: Math.max(2, Math.round(size * 0.07)),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entity.logoPath!}
          alt={entity.name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }

  // Fallback — colored initials avatar
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center font-bold select-none ${roundedClass} ${className}`}
      style={{
        width: size,
        height: size,
        background: dark ? `${entity.color}28` : `${entity.color}18`,
        color: entity.color,
        fontSize: Math.round(size * 0.34),
        letterSpacing: "-0.02em",
      }}
    >
      {entity.initials}
    </div>
  );
}

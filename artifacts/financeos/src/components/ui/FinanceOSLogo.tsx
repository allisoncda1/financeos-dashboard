interface Props {
  /**
   * full     — icon + wordmark lockup (login, home, headers)
   * icon     — square icon only (favicons, compact spaces)
   * sidebar  — icon + wordmark lockup for the sidebar header
   *
   * `full` and `sidebar` render the same single lockup asset; only the
   * caller-provided sizing (via className) differs. Callers control size —
   * the image keeps its aspect ratio (use an `h-*` class with `w-auto`).
   */
  variant?: "full" | "icon" | "sidebar";
  className?: string;
}

const LOCKUP = "/branding/financeos-lockup.png";
const LOCKUP_LIGHT = "/branding/financeos-lockup-light.png";
const ICON = "/branding/financeos-icon.png";

export function FinanceOSLogo({ variant = "full", className }: Props) {
  const src =
    variant === "icon"
      ? ICON
      : variant === "sidebar"
        ? LOCKUP_LIGHT
        : LOCKUP;
  return (
    <img
      src={src}
      alt="FinanceOS"
      className={className}
      draggable={false}
    />
  );
}

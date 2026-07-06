interface Props {
  /**
   * full     — horizontal: icon + wordmark (login, headers)
   * icon     — square icon only (favicons, compact spaces)
   * sidebar  — icon + wordmark stacked for sidebar header
   */
  variant?: "full" | "icon" | "sidebar";
  className?: string;
}

export function FinanceOSLogo({ variant = "full", className }: Props) {
  if (variant === "icon") {
    return (
      <img
        src="/branding/financeos-icon.svg"
        alt="FinanceOS"
        className={className}
        draggable={false}
      />
    );
  }

  if (variant === "sidebar") {
    return (
      <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
        <img
          src="/branding/financeos-icon.svg"
          alt=""
          aria-hidden="true"
          className="w-7 h-7 flex-shrink-0"
          draggable={false}
        />
        <img
          src="/branding/financeos-logo.svg"
          alt="FinanceOS"
          className="h-5 flex-1 object-contain object-left"
          draggable={false}
        />
      </div>
    );
  }

  // variant === "full"
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
      <img
        src="/branding/financeos-icon.svg"
        alt=""
        aria-hidden="true"
        className="w-10 h-10"
        draggable={false}
      />
      <img
        src="/branding/financeos-logo.svg"
        alt="FinanceOS"
        className="h-5 object-contain"
        draggable={false}
      />
    </div>
  );
}

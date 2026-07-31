import { NavLink } from "react-router-dom";
import { useCommissionEntity } from "@/lib/commission-context";

const NAV: { label: string; href: string }[] = [
  { label: "Overview",   href: ""            },
  { label: "Invoices",   href: "/invoices"   },
  { label: "Sales Reps", href: "/sales-reps" },
  { label: "Review",     href: "/review"     },
  { label: "Payouts",    href: "/payouts"    },
  { label: "Reports",    href: "/reports"    },
];

export function CommissionSidebar() {
  const { activeSlug } = useCommissionEntity();
  const base = `/commissions/${activeSlug}`;
  return (
    <nav className="w-48 shrink-0 border-r border-gray-100 bg-white py-4 flex flex-col gap-0.5 text-sm">
      {NAV.map(({ label, href }) => (
        <NavLink
          key={href}
          to={`${base}${href}`}
          end={href === ""}
          className={({ isActive }) =>
            `px-4 py-2 rounded-md mx-2 font-medium transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

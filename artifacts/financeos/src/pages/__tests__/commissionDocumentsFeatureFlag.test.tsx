/**
 * COMMISSION_DOCUMENTS_ENABLED — frontend behavior.
 *
 *   1. CommissionSidebar: the "Documents" nav item is present/absent based
 *      on AuthedUser.commissionDocumentsEnabled (rendered component test).
 *   2. App.tsx's CommissionRoutes: the Documents routes are structurally
 *      gated behind the same flag, with a catch-all NotFound still present.
 *      App.tsx statically imports ~100 page components across every module
 *      (Accounting/Forecast/Analytics/etc.) — fully rendering it here would
 *      require mocking that entire unrelated surface for no added
 *      confidence over a source-level check. This follows the same
 *      precedent already used in this codebase for other large,
 *      hard-to-render files (e.g. commissions.route.test.ts's P31 block and
 *      reportArchiveStorage.test.ts read source text and assert on it
 *      directly rather than executing the whole module).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import React from "react";

vi.mock("@/lib/commission-context", () => ({
  useCommissionEntity: () => ({ activeSlug: "cardealer_ai" }),
}));
vi.mock("@/components/shared/SidebarCompanyCard", () => ({
  SidebarCompanyCard: () => <div data-testid="sidebar-company-card" />,
}));
vi.mock("@/components/ui/FinanceOSLogo", () => ({
  FinanceOSLogo: () => <div />,
}));
vi.mock("@/lib/next-compat", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/commissions",
}));
vi.mock("framer-motion", () => {
  const El = (tag: string) => ({ children, layoutId, initial, animate, exit, transition, ...rest }: {
    children?: React.ReactNode; layoutId?: string; initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown; [k: string]: unknown;
  }) => React.createElement(tag, rest, children);
  return {
    motion: { div: El("div"), span: El("span") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

let mockUser: { name: string; role: string; commissionDocumentsEnabled: boolean } | null = null;
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

import { CommissionSidebar } from "../../components/commission/CommissionSidebar";

describe("CommissionSidebar — Documents nav item gated by commissionDocumentsEnabled", () => {
  it("is absent when commissionDocumentsEnabled is false", () => {
    mockUser = { name: "Test", role: "admin", commissionDocumentsEnabled: false };
    render(<CommissionSidebar />);
    expect(screen.queryByTestId("nav-commission-documents")).toBeNull();
  });

  it("is absent when the user is null (not yet loaded) — never defaults to visible", () => {
    mockUser = null;
    render(<CommissionSidebar />);
    expect(screen.queryByTestId("nav-commission-documents")).toBeNull();
  });

  it("is present when commissionDocumentsEnabled is true", () => {
    mockUser = { name: "Test", role: "admin", commissionDocumentsEnabled: true };
    render(<CommissionSidebar />);
    expect(screen.queryByTestId("nav-commission-documents")).not.toBeNull();
  });

  it("every OTHER nav item is present regardless of the flag (only Documents is gated)", () => {
    mockUser = { name: "Test", role: "admin", commissionDocumentsEnabled: false };
    render(<CommissionSidebar />);
    for (const testId of [
      "nav-commission-overview", "nav-commission-invoices", "nav-commission-sales-reps",
      "nav-commission-review", "nav-commission-payouts", "nav-commission-reports",
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeNull();
    }
  });
});

describe("App.tsx CommissionRoutes — Documents routes structurally gated behind the same flag", () => {
  const appSrc = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../App.tsx"),
    "utf8",
  );
  // Isolate just the CommissionRoutes function body for these assertions.
  const fnMatch = appSrc.match(/function CommissionRoutes\(\)[\s\S]*?\n}\n/);
  const commissionRoutesSrc = fnMatch ? fnMatch[0] : "";

  it("CommissionRoutes reads commissionDocumentsEnabled from the authenticated user, never defaulting it to true", () => {
    expect(commissionRoutesSrc).toMatch(/user\?\.commissionDocumentsEnabled/);
  });

  it("both /commissions/documents routes are conditionally rendered based on that flag", () => {
    expect(commissionRoutesSrc).toMatch(/documentsEnabled\s*&&\s*<Route path="\/commissions\/documents\/:documentId"/);
    expect(commissionRoutesSrc).toMatch(/documentsEnabled\s*&&\s*<Route path="\/commissions\/documents"/);
  });

  it("a catch-all NotFound route still exists — a disabled Documents URL falls through to it, not a crash or blank page", () => {
    expect(commissionRoutesSrc).toMatch(/<Route component=\{NotFound\}\s*\/>/);
  });

  it("no OTHER commission route in this function is flag-gated (only Documents is)", () => {
    const otherRoutes = [
      "/commissions/invoices", "/commissions/sales-reps", "/commissions/review",
      "/commissions/payouts", "/commissions/reports",
    ];
    for (const route of otherRoutes) {
      const routeLine = commissionRoutesSrc.split("\n").find((l) => l.includes(`path="${route}"`));
      expect(routeLine, `expected a route line for ${route}`).toBeTruthy();
      expect(routeLine).not.toMatch(/documentsEnabled/);
    }
  });
});

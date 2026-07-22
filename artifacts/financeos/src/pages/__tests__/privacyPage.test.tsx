import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PrivacyPage from "../privacy";

describe("FinanceOS public privacy policy", () => {
  it("renders the approved policy identity and effective date", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "FinanceOS Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getAllByText("July 22, 2026").length).toBeGreaterThan(0);
    expect(screen.getByText(/Approved by:/)).toBeInTheDocument();
  });

  it("states the internal-only scope and does not imply public app access", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/not sold or offered to external clients/i)).toBeInTheDocument();
    expect(screen.getByText(/does not provide access to the FinanceOS application/i)).toBeInTheDocument();
    expect(screen.getByText(/will not invite external customers/i)).toBeInTheDocument();
  });

  it("provides a working privacy contact", () => {
    render(<PrivacyPage />);

    const links = screen.getAllByRole("link", { name: "allison@cardealer.ai" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", "mailto:allison@cardealer.ai");
  });

  it("registers /privacy as a public route before the protected catch-all", () => {
    const appPath = resolve(process.cwd(), "src/App.tsx");
    const source = readFileSync(appPath, "utf8");
    const privacyRoute = source.indexOf('<Route path="/privacy" component={PrivacyPage} />');
    const protectedCatchAll = source.indexOf("<ProtectedRoute>", source.indexOf("function Router()"));

    expect(privacyRoute).toBeGreaterThan(-1);
    expect(protectedCatchAll).toBeGreaterThan(privacyRoute);
  });
});

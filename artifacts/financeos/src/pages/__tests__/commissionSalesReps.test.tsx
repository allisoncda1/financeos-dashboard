/**
 * Commission Sales Reps — "Add Sales Representative" flow.
 *
 * Regression coverage for the fix: the frontend previously sent a bare
 * string where the backend expects { displayName }, and the client's
 * postEnvelope helper never surfaced an error `code`, so duplicate-name
 * detection was unreachable dead code. These tests exercise the full
 * component against a mocked api module (no real network/DB).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/components/commission/CommissionLayout", () => ({
  CommissionLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/commission-context", () => ({
  useCommissionEntity: () => ({ activeSlug: "cardealer_ai", activePeriod: "2026-08" }),
}));

const listMock   = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    commissionRepresentatives: (...a: unknown[]) => listMock(...a),
    createCommissionRepresentative: (...a: unknown[]) => createMock(...a),
    commissionLines: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import CommissionSalesRepsPage from "../commissions/sales-reps";

async function openModal() {
  render(<CommissionSalesRepsPage />);
  await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByRole("button", { name: "Add Sales Rep" }));
}

function nameInput() {
  return screen.getByPlaceholderText(/e\.g\. jason smith/i);
}

function submitButton() {
  return screen.getByRole("button", { name: /^add representative$/i });
}

describe("Add Sales Representative flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({ data: [] });
  });

  it("sends { displayName } to the correct slug — not a bare string, not a client-invented slug", async () => {
    createMock.mockResolvedValue({
      id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith",
      representativeType: "external_rep", payoutEligible: true, notes: null,
    });
    await openModal();
    await userEvent.type(nameInput(), "Jason Smith");
    await userEvent.click(submitButton());
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith("cardealer_ai", { displayName: "Jason Smith" })
    );
  });

  it("trims surrounding whitespace before sending", async () => {
    createMock.mockResolvedValue({
      id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith",
      representativeType: "external_rep", payoutEligible: true, notes: null,
    });
    await openModal();
    await userEvent.type(nameInput(), "  Jason Smith  ");
    await userEvent.click(submitButton());
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith("cardealer_ai", { displayName: "Jason Smith" })
    );
  });

  it("refuses an empty or whitespace-only name — submit stays disabled, no API call", async () => {
    await openModal();
    expect(submitButton()).toBeDisabled();
    await userEvent.type(nameInput(), "   ");
    expect(submitButton()).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("on success: closes the modal and refetches the representative list", async () => {
    createMock.mockResolvedValue({
      id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith",
      representativeType: "external_rep", payoutEligible: true, notes: null,
    });
    await openModal();
    expect(listMock).toHaveBeenCalledTimes(1);
    await userEvent.type(nameInput(), "Jason Smith");
    await userEvent.click(submitButton());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("Add Sales Representative")).not.toBeInTheDocument()
    );
  });

  it("a duplicate name shows a specific, non-technical message and keeps the modal open", async () => {
    createMock.mockRejectedValue(
      Object.assign(new Error("A representative with that name already exists"), {
        code: "DUPLICATE_SLUG",
      })
    );
    await openModal();
    await userEvent.type(nameInput(), "Jason Smith");
    await userEvent.click(submitButton());
    expect(await screen.findByText("A representative with that name already exists.")).toBeTruthy();
    expect(screen.getByText("Add Sales Representative")).toBeTruthy();
  });

  it("a generic API error shows a friendly message — no raw error/stack leaked", async () => {
    createMock.mockRejectedValue(new Error('relation "commission_representatives" does not exist at db.ts:214'));
    await openModal();
    await userEvent.type(nameInput(), "Jason Smith");
    await userEvent.click(submitButton());
    expect(await screen.findByText("Failed to add representative. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/relation|does not exist|db\.ts/i)).not.toBeInTheDocument();
  });

  it("entity isolation: the active entity slug is the one sent to the API", async () => {
    createMock.mockResolvedValue({
      id: "uuid-2", displayName: "Alex Rivera", slug: "alex_rivera",
      representativeType: "external_rep", payoutEligible: true, notes: null,
    });
    await openModal();
    await userEvent.type(nameInput(), "Alex Rivera");
    await userEvent.click(submitButton());
    await waitFor(() => {
      const [slugArg] = createMock.mock.calls[0];
      expect(slugArg).toBe("cardealer_ai");
    });
  });
});

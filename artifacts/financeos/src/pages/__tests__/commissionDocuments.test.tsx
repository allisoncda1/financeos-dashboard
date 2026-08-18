/**
 * Commission Documents — list/upload page tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/components/commission/CommissionLayout", () => ({
  CommissionLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/commission-context", () => ({
  useCommissionEntity: () => ({ activeSlug: "cardealer_ai" }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/commissions/documents", vi.fn()],
}));

const listMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    commissionDocuments: (...a: unknown[]) => listMock(...a),
    uploadCommissionDocument: (...a: unknown[]) => uploadMock(...a),
  },
}));

import CommissionDocumentsPage from "../commissions/documents";

function pdfFile(name = "invoice.pdf") {
  return new File(["%PDF-1.4 fake"], name, { type: "application/pdf" });
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue({ data: [] });
});

describe("Commission Documents — list", () => {
  it("shows an empty state when there are no documents", async () => {
    render(<CommissionDocumentsPage />);
    expect(await screen.findByText("No documents uploaded yet.")).toBeTruthy();
  });

  it("renders uploaded documents with vendor name, total, and status", async () => {
    listMock.mockResolvedValue({
      data: [{ id: "doc-1", vendorName: "MCA", fileName: "mca.pdf", documentNumber: "MCA2026_016", documentTotal: "1446.53", status: "needs_review" }],
    });
    render(<CommissionDocumentsPage />);
    expect(await screen.findByText("MCA")).toBeTruthy();
    expect(screen.getByText("$1446.53")).toBeTruthy();
    expect(screen.getByTestId("document-status-needs_review")).toBeTruthy();
  });
});

describe("Commission Documents — upload", () => {
  it("uploads a valid PDF via the file picker and refreshes the list", async () => {
    uploadMock.mockResolvedValue({ data: { id: "doc-2" }, status: 202 });
    render(<CommissionDocumentsPage />);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

    const input = screen.getByTestId("input-file") as HTMLInputElement;
    await userEvent.upload(input, pdfFile());

    await waitFor(() => expect(uploadMock).toHaveBeenCalledWith("cardealer_ai", expect.any(File)));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("rejects a non-PDF file dropped via drag-and-drop (accept= filtering only protects the file picker, not drop)", async () => {
    render(<CommissionDocumentsPage />);
    const dropzone = screen.getByTestId("document-dropzone");
    const textFile = new File(["not a pdf"], "invoice.txt", { type: "text/plain" });

    fireEvent.drop(dropzone, { dataTransfer: { files: [textFile] } });

    expect(await screen.findByTestId("upload-error")).toHaveTextContent("Only PDF files are accepted.");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("shows a specific message for a duplicate upload", async () => {
    uploadMock.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "DUPLICATE_DOCUMENT" }));
    render(<CommissionDocumentsPage />);
    const input = screen.getByTestId("input-file") as HTMLInputElement;
    await userEvent.upload(input, pdfFile());

    expect(await screen.findByTestId("upload-error")).toHaveTextContent(/already been uploaded/);
  });

  it("shows a generic error message for an unexpected upload failure — no raw error leaked", async () => {
    uploadMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:443 at /internal/path"));
    render(<CommissionDocumentsPage />);
    const input = screen.getByTestId("input-file") as HTMLInputElement;
    await userEvent.upload(input, pdfFile());

    const err = await screen.findByTestId("upload-error");
    expect(err).toHaveTextContent("Upload failed. Please try again.");
    expect(err.textContent).not.toMatch(/10\.0\.0\.5|ECONNREFUSED|internal/);
  });
});

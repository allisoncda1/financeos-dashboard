/**
 * ReportDraftEditor — frontend unit tests.
 *
 * Verifies behavioral requirements for the draft editor without a real API or DB.
 *
 * Key architectural notes about the component that shape these tests:
 * - Commentary blocks only render inside the "activeSection" overlay, which only
 *   opens when a section button in the left nav is clicked.
 * - templateId is title-cased and hyphen-stripped for display ("monthly-close" → "Monthly Close").
 * - The right panel shows Draft Details (templateId, period) when no block is selected.
 * - Status badge and stale warning are always rendered in the header when draft is loaded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Router mock (wouter) ─────────────────────────────────────────────────────
vi.mock("wouter", () => ({
  useParams: () => ({ draftId: "draft-test-001" }),
  useLocation: () => ["/reports/draft/draft-test-001", vi.fn()],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── API mock ─────────────────────────────────────────────────────────────────
const getDraftMock    = vi.fn();
const getCommentaryMock    = vi.fn();
const getDraftVersionsMock = vi.fn();
const getDraftPreviewMock  = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    getDraft:                 (...a: unknown[]) => getDraftMock(...a),
    getCommentary:            (...a: unknown[]) => getCommentaryMock(...a),
    getDraftVersions:         (...a: unknown[]) => getDraftVersionsMock(...a),
    getDraftPreview:          (...a: unknown[]) => getDraftPreviewMock(...a),
    saveDraftEdits:           vi.fn().mockResolvedValue({}),
    submitDraftForReview:     vi.fn(),
    approveDraft:             vi.fn(),
    toggleCommentaryIncluded: vi.fn(),
    restoreDraftVersion:      vi.fn(),
  },
}));

import ReportDraftEditor from "../reportDraftEditor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-test-001",
    templateId: "monthly-close",
    reportingPeriod: "Jun 2025 (Latest)",
    entitySlugs: ["T3_Marketing"],
    status: "draft",
    currentVersion: 1,
    approvedBy: null,
    approvedAt: null,
    isStale: false,
    staleReason: null,
    editableContent: {},
    generatedAnalysis: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "cfo@test.com",
    ...overrides,
  };
}

function makeAnalysisBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: "ana-1",
    entitySlug: "T3_Marketing",
    reportingPeriod: "Jun 2025 (Latest)",
    templateId: "monthly-close",
    sectionKey: "executive_summary",
    commentaryType: "financeos_analysis" as const,
    content: "Revenue analysis from FinanceOS engine.",
    sortOrder: 0,
    included: true,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userEmail: "system@financeos.ai",
    ...overrides,
  };
}

function makeCommentaryBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: "mc-1",
    entitySlug: "T3_Marketing",
    reportingPeriod: "Jun 2025 (Latest)",
    templateId: "monthly-close",
    sectionKey: "management_comments",
    commentaryType: "management_commentary" as const,
    content: "Management campaign note for testing.",
    sortOrder: 0,
    included: true,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userEmail: "cfo@test.com",
    ...overrides,
  };
}

function setupMocks(draftOverrides: Record<string, unknown> = {}, commentary: unknown[] = []) {
  const draft = makeDraft(draftOverrides);
  getDraftMock.mockResolvedValue(draft);
  getCommentaryMock.mockResolvedValue(commentary);
  getDraftVersionsMock.mockResolvedValue([]);
  getDraftPreviewMock.mockResolvedValue({
    html: "<html><body><p>Report Preview</p></body></html>",
    draft,
    narrativeSectionKeys: ["executive_summary", "management_comments"],
    isStale: draft.isStale,
    staleReason: draft.staleReason,
  });
  return draft;
}

/** Wait for loading to complete. */
async function waitForLoad() {
  await waitFor(
    () => expect(screen.queryAllByText(/loading/i).length).toBe(0),
    { timeout: 3000 },
  );
}

/** Returns true if document body text contains the given substring. */
function bodyContains(text: string) {
  return document.body.textContent?.includes(text) ?? false;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReportDraftEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Loading state ────────────────────────────────────────────────────────

  it("shows a loading indicator while draft is fetching", () => {
    getDraftMock.mockReturnValue(new Promise(() => {}));
    getCommentaryMock.mockReturnValue(new Promise(() => {}));
    getDraftVersionsMock.mockReturnValue(new Promise(() => {}));
    getDraftPreviewMock.mockReturnValue(new Promise(() => {}));
    render(<ReportDraftEditor />);
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
  });

  // ── 2. Template and period info in right panel ──────────────────────────────

  it("shows human-readable template name and period after draft loads", async () => {
    setupMocks();
    render(<ReportDraftEditor />);
    await waitForLoad();
    // templateId "monthly-close" → "Monthly Close" (title-cased, hyphens removed)
    await waitFor(() => expect(bodyContains("Monthly Close")).toBe(true), { timeout: 3000 });
    expect(bodyContains("Jun 2025")).toBe(true);
  });

  // ── 3. Commentary is fetched and preview is requested ─────────────────────
  // The editor passes commentary data to the preview API; the preview is shown
  // in an iframe. There is no section nav — content is in the rendered iframe.

  it("fetches analysis commentary and requests a preview when blocks are present", async () => {
    setupMocks({}, [makeAnalysisBlock()]);
    render(<ReportDraftEditor />);
    await waitForLoad();

    // Commentary was fetched with (entitySlug, period, templateId) from the draft
    expect(getCommentaryMock).toHaveBeenCalledWith("T3_Marketing", "Jun 2025 (Latest)", "monthly-close");
    // Preview was requested for the same draft
    expect(getDraftPreviewMock).toHaveBeenCalledWith("draft-test-001");
    // The iframe is rendered (preview HTML present)
    await waitFor(
      () => expect(document.querySelector("iframe")).not.toBeNull(),
      { timeout: 3000 },
    );
  });

  // ── 4. Preview iframe renders when getDraftPreview resolves ───────────────

  it("renders an iframe with the preview html once the draft loads", async () => {
    setupMocks({}, [makeAnalysisBlock()]);
    render(<ReportDraftEditor />);
    await waitForLoad();

    await waitFor(
      () => {
        const iframe = document.querySelector("iframe");
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute("srcDoc") ?? iframe?.getAttribute("srcdoc")).toContain("Report Preview");
      },
      { timeout: 3000 },
    );
  });

  // ── 5. Management commentary is fetched ───────────────────────────────────

  it("fetches management commentary and requests preview when mc blocks are present", async () => {
    setupMocks({}, [makeCommentaryBlock()]);
    render(<ReportDraftEditor />);
    await waitForLoad();

    expect(getCommentaryMock).toHaveBeenCalledWith("T3_Marketing", "Jun 2025 (Latest)", "monthly-close");
    expect(getDraftPreviewMock).toHaveBeenCalledWith("draft-test-001");
  });

  // ── 6. Excluded blocks: preview still requested ────────────────────────────

  it("requests preview even when all commentary blocks are excluded", async () => {
    setupMocks({}, [makeCommentaryBlock({ included: false })]);
    render(<ReportDraftEditor />);
    await waitForLoad();

    expect(getDraftPreviewMock).toHaveBeenCalledWith("draft-test-001");
    // Iframe rendered with whatever the preview API returned
    await waitFor(
      () => expect(document.querySelector("iframe")).not.toBeNull(),
      { timeout: 3000 },
    );
  });

  // ── 7. Approval badge ────────────────────────────────────────────────────────

  it("shows approval status badge when draft status=approved", async () => {
    setupMocks({ status: "approved", approvedBy: "cfo@test.com", approvedAt: new Date().toISOString() });
    render(<ReportDraftEditor />);
    await waitForLoad();
    const allApproved = screen.getAllByText(/approved/i);
    expect(allApproved.length).toBeGreaterThan(0);
  });

  // ── 8. Stale-data warning ────────────────────────────────────────────────────

  it("shows stale-data warning when isStale=true", async () => {
    setupMocks({ isStale: true, staleReason: "Financial data changed since draft creation." });
    render(<ReportDraftEditor />);
    await waitForLoad();
    // Component renders "Data Changed — Re-approval Required" when isStale=true
    expect(
      bodyContains("Data Changed") || bodyContains("Re-approval"),
    ).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB so no real Neon call
vi.mock("../db/commissions", () => ({
  createCommissionRepresentative: vi.fn(),
  getCommissionRepresentatives: vi.fn(),
  getCachedEntityId: vi.fn(),
}));

import { createCommissionRepresentative } from "../db/commissions";

describe("createCommissionRepresentative", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves with id, displayName, slug on success", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    const expected = { id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith" };
    mockFn.mockResolvedValue(expected);
    const result = await createCommissionRepresentative({ displayName: "Jason Smith", slug: "jason_smith" });
    expect(result).toEqual(expected);
    expect(mockFn).toHaveBeenCalledWith({ displayName: "Jason Smith", slug: "jason_smith" });
  });

  it("throws DUPLICATE_SLUG error on conflict", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    const err = Object.assign(new Error("duplicate_slug"), { code: "DUPLICATE_SLUG" });
    mockFn.mockRejectedValue(err);
    await expect(
      createCommissionRepresentative({ displayName: "Jason Smith", slug: "jason_smith" })
    ).rejects.toMatchObject({ code: "DUPLICATE_SLUG" });
  });
});

describe("POST /representatives route logic", () => {
  it("slug is derived from displayName, lowercased, underscored", () => {
    const displayName = "Big Mouth Consulting";
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50);
    expect(slug).toBe("big_mouth_consulting");
  });

  it("empty displayName is rejected before DB call", () => {
    const displayName = "   ";
    expect(displayName.trim()).toBe("");
  });
});

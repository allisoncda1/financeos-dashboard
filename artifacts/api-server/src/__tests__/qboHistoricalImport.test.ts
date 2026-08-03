import { describe, expect, it } from "vitest";
import { extractQboHistoricalLines } from "../db/qboHistoricalImport";

describe("extractQboHistoricalLines", () => {
  it("returns no lines for malformed payloads", () => {
    expect(extractQboHistoricalLines(null)).toEqual([]);
    expect(extractQboHistoricalLines([])).toEqual([]);
    expect(extractQboHistoricalLines({})).toEqual([]);
  });

  it("preserves the exact QBO account name", () => {
    const result = extractQboHistoricalLines({
      Line: [{
        Amount: 125.5,
        Description: "Campaign",
        PurchaseLineDetail: {
          AccountRef: {
            value: "account-1",
            name: "Advertising & Marketing",
          },
        },
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.coaAccountId).toBe("account-1");
    expect(result[0]?.coaAccountName)
      .toBe("Advertising & Marketing");
    expect(result[0]?.lineAmount).toBe(125.5);
    expect(result[0]?.memo).toBe("Campaign");
  });

  it("preserves the exact QBO class", () => {
    const result = extractQboHistoricalLines({
      Line: [{
        JournalEntryLineDetail: {
          AccountRef: {
            value: "expense-1",
            name: "Software",
          },
          ClassRef: {
            value: "class-1",
            name: "CarDealer.ai",
          },
        },
      }],
    });

    expect(result[0]?.qboClassId).toBe("class-1");
    expect(result[0]?.qboClassName).toBe("CarDealer.ai");
  });

  it("supports split transactions", () => {
    const result = extractQboHistoricalLines({
      Line: [
        {
          Amount: 75,
          PurchaseLineDetail: {
            AccountRef: { value: "a1", name: "Meals" },
          },
        },
        {
          Amount: 25,
          PurchaseLineDetail: {
            AccountRef: { value: "a2", name: "Travel" },
          },
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result.map((line) => line.lineIndex)).toEqual([0, 1]);
    expect(result.map((line) => line.coaAccountName))
      .toEqual(["Meals", "Travel"]);
  });

  it("ignores QBO lines without AccountRef", () => {
    const result = extractQboHistoricalLines({
      Line: [
        { Amount: 100, DescriptionOnly: {} },
        {
          Amount: 50,
          PurchaseLineDetail: {
            ClassRef: { value: "class-1", name: "Operations" },
          },
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it("does not trim QBO account or class names", () => {
    const result = extractQboHistoricalLines({
      Line: [{
        Amount: "10.00",
        PurchaseLineDetail: {
          AccountRef: {
            value: "a1",
            name: "  Exact QBO Account  ",
          },
          ClassRef: {
            value: "c1",
            name: "  Exact QBO Class  ",
          },
        },
      }],
    });

    expect(result[0]?.coaAccountName)
      .toBe("  Exact QBO Account  ");
    expect(result[0]?.qboClassName)
      .toBe("  Exact QBO Class  ");
    expect(result[0]?.lineAmount).toBe(10);
  });
});

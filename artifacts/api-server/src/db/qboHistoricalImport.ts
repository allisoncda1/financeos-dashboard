/**
 * Pure extraction logic for historical QBO allocation lines.
 *
 * No database access.
 * No Plaid mutation.
 * No reconciliation.
 * QBO account and class names are preserved exactly.
 */

export interface QboHistoricalLine {
  lineIndex: number;
  detailType: string;
  coaAccountId: string;
  coaAccountName: string | null;
  coaAccountType: string | null;
  coaAccountFullyQualifiedName: string | null;
  coaAccountSubtype: string | null;
  coaAccountClassification: string | null;
  qboClassId: string | null;
  qboClassName: string | null;
  lineAmount: number | null;
  memo: string | null;
  rawLine: Record<string, unknown>;
}

function record(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

function amount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface QboMatchCandidate {
  plaidTransactionId: string;
  qboId: string;
  dateDeltaDays: number;
}

export interface QboMatchAllocation {
  matches: QboMatchCandidate[];
  duplicateClaimsExcluded: number;
  ambiguousClaimsExcluded: number;
}

export function allocateUniqueQboMatches(
  candidates: QboMatchCandidate[],
): QboMatchAllocation {
  const claimsByQboId = new Map<
    string,
    QboMatchCandidate[]
  >();

  for (const candidate of candidates) {
    const claims = claimsByQboId.get(candidate.qboId) ?? [];
    claims.push(candidate);
    claimsByQboId.set(candidate.qboId, claims);
  }

  const matches: QboMatchCandidate[] = [];
  let duplicateClaimsExcluded = 0;
  let ambiguousClaimsExcluded = 0;

  for (const claims of claimsByQboId.values()) {
    const minimumDelta = Math.min(
      ...claims.map((claim) => claim.dateDeltaDays),
    );
    const bestClaims = claims.filter(
      (claim) => claim.dateDeltaDays === minimumDelta,
    );

    if (bestClaims.length !== 1) {
      ambiguousClaimsExcluded += claims.length;
      continue;
    }

    matches.push(bestClaims[0]!);
    duplicateClaimsExcluded += claims.length - 1;
  }

  return {
    matches,
    duplicateClaimsExcluded,
    ambiguousClaimsExcluded,
  };
}

export function extractQboHistoricalLines(
  payload: unknown,
): QboHistoricalLine[] {
  const payloadRecord = record(payload);
  if (!payloadRecord) return [];

  const rawLines = payloadRecord["Line"];
  if (!Array.isArray(rawLines)) return [];

  const result: QboHistoricalLine[] = [];

  rawLines.forEach((rawLine, lineIndex) => {
    const line = record(rawLine);
    if (!line) return;

    for (const [detailType, rawDetail] of Object.entries(line)) {
      if (!detailType.endsWith("LineDetail")) continue;

      const detail = record(rawDetail);
      if (!detail) continue;

      const accountRef = record(detail["AccountRef"]);
      if (!accountRef) continue;

      const coaAccountId = text(accountRef["value"]);
      if (!coaAccountId) continue;

      const classRef = record(detail["ClassRef"]);

      result.push({
        lineIndex,
        detailType,
        coaAccountId,
        coaAccountName: text(accountRef["name"]),
        coaAccountType: null,
        coaAccountFullyQualifiedName: null,
        coaAccountSubtype: null,
        coaAccountClassification: null,
        qboClassId: classRef ? text(classRef["value"]) : null,
        qboClassName: classRef ? text(classRef["name"]) : null,
        lineAmount: amount(line["Amount"] ?? detail["Amount"]),
        memo:
          text(line["Description"]) ??
          text(detail["Description"]) ??
          null,
        rawLine: line,
      });

      // A QBO line normally contains one *LineDetail object.
      // Stop after the first categorizable detail so lineIndex stays unique.
      break;
    }
  });

  return result;
}

import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type {
  CommissionDocument, CommissionDocumentLine, CommissionRunLine,
  CommissionExpenseAllocation, CommissionDocumentEvent,
} from "@/lib/api";
import { ArrowLeft, RefreshCw, Archive, CheckCircle2, AlertTriangle } from "lucide-react";

function fmt(v: string | null | undefined) {
  if (v == null) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

/** A document is manually retryable when extraction has definitively failed,
 * or when it's stuck 'processing' past its lease (the worker that claimed it
 * crashed and never completed) — the opportunistic list-page sweep usually
 * recovers the latter on its own, but a manual retry must also be offered
 * here so a user isn't stuck waiting on a document detail page. */
function isRetryable(document: CommissionDocument): boolean {
  if (document.status === "failed") return true;
  if (document.status === "processing" && document.leaseExpiresAt) {
    return new Date(document.leaseExpiresAt).getTime() < Date.now();
  }
  return false;
}

function LineMatcher({
  slug, documentId, line, onConfirmed,
}: { slug: string; documentId: string; line: CommissionDocumentLine; onConfirmed: () => void }) {
  const [candidates, setCandidates] = useState<Array<{ commissionRunLine: CommissionRunLine; confidence: number }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function findMatches() {
    setLoading(true);
    try {
      const res = await api.documentLineCandidates(slug, documentId, line.id);
      const data = Array.isArray(res) ? res : (res as { data?: typeof candidates }).data ?? [];
      setCandidates(data);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    try {
      await api.confirmDocumentLineMatch(slug, documentId, line.id, selected);
      onConfirmed();
    } finally {
      setConfirming(false);
    }
  }

  async function ignore() {
    await api.ignoreDocumentLine(slug, documentId, line.id);
    onConfirmed();
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {!candidates ? (
        <button onClick={findMatches} disabled={loading} className="text-xs font-semibold text-blue-600 hover:text-blue-700" data-testid={`button-find-matches-${line.id}`}>
          {loading ? "Searching…" : "Find matching invoice…"}
        </button>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-gray-400">No candidate invoices found for this period/entity.</p>
      ) : (
        <div className="space-y-1">
          {candidates.map((c) => (
            <label key={c.commissionRunLine.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="radio" name={`match-${line.id}`} checked={selected === c.commissionRunLine.id} onChange={() => setSelected(c.commissionRunLine.id)} />
              <span className="flex-1">{c.commissionRunLine.customerName ?? "(unknown customer)"} — {fmt(c.commissionRunLine.invoiceAmount)}</span>
              <span className="text-gray-400">{Math.round(c.confidence * 100)}% match</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        {candidates && candidates.length > 0 && (
          <button onClick={confirm} disabled={!selected || confirming} className="text-xs font-semibold bg-blue-600 text-white px-3 py-1 rounded-md disabled:opacity-50" data-testid={`button-confirm-match-${line.id}`}>
            {confirming ? "Confirming…" : "Confirm match"}
          </button>
        )}
        <button onClick={ignore} className="text-xs font-medium text-gray-400 hover:text-gray-600" data-testid={`button-ignore-line-${line.id}`}>Ignore this line</button>
      </div>
    </div>
  );
}

function AllocationPanel({
  slug, documentId, line, onApplied,
}: { slug: string; documentId: string; line: CommissionDocumentLine; onApplied: () => void }) {
  const [preview, setPreview] = useState<{ documentLine: CommissionDocumentLine; existingAllocations: CommissionExpenseAllocation[]; newAllocationAmount: string | null } | null>(null);
  const [method, setMethod] = useState<"fixed_amount" | "percentage_of_expense" | "full_expense">("fixed_amount");
  const [amount, setAmount] = useState(line.extractedAmount ?? "");
  const [percentage, setPercentage] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ grossProfit: string | null; commissionAmount: string | null; configured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!line.confirmedInvoiceId) return;
    api.documentLineAllocationPreview(slug, documentId, line.id).then((res) => {
      const data = (res as { data?: typeof preview }).data ?? (res as typeof preview);
      setPreview(data);
    }).catch(() => {});
  }, [slug, documentId, line.id, line.confirmedInvoiceId]);

  async function allocate() {
    if (!line.confirmedInvoiceId || !reason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let allocatedAmount = amount;
      if (method === "full_expense") allocatedAmount = line.extractedAmount ?? "0.00";
      const res = await api.createDocumentLineAllocations(slug, documentId, line.id, [{
        commissionRunLineId: line.confirmedInvoiceId,
        allocationMethod: method,
        allocatedAmount: method === "percentage_of_expense" ? percentage : allocatedAmount,
        reason: reason.trim(),
      }]);
      const data = (res as { data?: { recalculated: Array<{ grossProfit: string | null; commissionAmount: string | null; configured: boolean }> } }).data;
      if (data?.recalculated?.[0]) setResult(data.recalculated[0]);
      onApplied();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Allocation failed";
      setError(msg.includes("exceeds") ? "This allocation would exceed the source document amount." : "Allocation failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!line.confirmedInvoiceId) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 bg-gray-50 rounded-lg p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">Allocate expense to matched invoice</p>
      {preview && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div><span className="text-gray-400">Existing allocations: </span>{preview.existingAllocations.length}</div>
          <div><span className="text-gray-400">Extracted amount: </span>{fmt(preview.newAllocationAmount)}</div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="text-xs border border-gray-200 rounded-md px-2 py-1" data-testid={`select-allocation-method-${line.id}`}>
          <option value="fixed_amount">Fixed amount</option>
          <option value="percentage_of_expense">Percentage of expense</option>
          <option value="full_expense">Full expense amount</option>
        </select>
        {method === "fixed_amount" && (
          <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="75.00" className="text-xs border border-gray-200 rounded-md px-2 py-1 w-24" data-testid={`input-allocation-amount-${line.id}`} />
        )}
        {method === "percentage_of_expense" && (
          <input type="text" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="7.5 (%)" className="text-xs border border-gray-200 rounded-md px-2 py-1 w-24" data-testid={`input-allocation-percentage-${line.id}`} />
        )}
      </div>
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason / justification (required)" className="text-xs border border-gray-200 rounded-md px-2 py-1 w-full mb-2" data-testid={`input-allocation-reason-${line.id}`} />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={allocate} disabled={saving || !reason.trim()} className="text-xs font-semibold bg-emerald-600 text-white px-3 py-1 rounded-md disabled:opacity-50" data-testid={`button-allocate-${line.id}`}>
        {saving ? "Allocating…" : "Allocate"}
      </button>
      {result && (
        <div className="mt-2 text-xs space-y-0.5">
          <p><span className="text-gray-400">Gross profit: </span>{fmt(result.grossProfit)}</p>
          <p><span className="text-gray-400">Commission: </span>{result.configured ? fmt(result.commissionAmount) : <span className="text-amber-600">not configured — no rate set for this representative</span>}</p>
        </div>
      )}
    </div>
  );
}

export default function CommissionDocumentDetailPage() {
  const { activeSlug } = useCommissionEntity();
  const [, params] = useRoute("/commissions/documents/:documentId");
  const [, navigate] = useLocation();
  const documentId = params?.documentId ?? "";
  const [document, setDocument] = useState<CommissionDocument | null>(null);
  const [lines, setLines] = useState<CommissionDocumentLine[]>([]);
  const [events, setEvents] = useState<CommissionDocumentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(() => {
    mounted.current = true;
    setLoading(true);
    Promise.all([
      api.commissionDocument(activeSlug, documentId),
      api.commissionDocumentEvents(activeSlug, documentId),
    ]).then(([docRes, eventsRes]) => {
      if (!mounted.current) return;
      const docData = (docRes as { data?: { document: CommissionDocument; lines: CommissionDocumentLine[] } }).data ?? (docRes as { document: CommissionDocument; lines: CommissionDocumentLine[] });
      setDocument(docData.document);
      setLines(docData.lines);
      const evData = Array.isArray(eventsRes) ? eventsRes : (eventsRes as { data?: CommissionDocumentEvent[] }).data ?? [];
      setEvents(evData);
      setLoading(false);
    }).catch(() => { if (mounted.current) setLoading(false); });
  }, [activeSlug, documentId]);

  useEffect(() => {
    load();
    return () => { mounted.current = false; };
  }, [load]);

  async function retry() {
    await api.retryDocumentExtraction(activeSlug, documentId);
    load();
  }

  async function apply() {
    setApplyError(null);
    try {
      await api.applyCommissionDocument(activeSlug, documentId);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not apply document.";
      setApplyError(msg);
    }
  }

  async function archive() {
    await api.archiveCommissionDocument(activeSlug, documentId);
    navigate("/commissions/documents");
  }

  if (loading || !document) {
    return (
      <CommissionLayout title="Document" subtitle={activeSlug}>
        <p className="text-sm text-gray-400 py-8">Loading…</p>
      </CommissionLayout>
    );
  }

  const unresolvedCount = lines.filter((l) => l.status === "unmatched" || l.status === "suggested").length;
  const canApply = document.status !== "applied" && document.status !== "archived" && unresolvedCount === 0;

  return (
    <CommissionLayout title={document.vendorName ?? document.fileName} subtitle={`${activeSlug} · ${document.documentNumber ?? document.fileName}`}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate("/commissions/documents")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Documents
        </button>
        <div className="flex gap-2">
          {isRetryable(document) && (
            <button onClick={retry} className="flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg" data-testid="button-retry-extraction">
              <RefreshCw className="w-3.5 h-3.5" /> Retry extraction
            </button>
          )}
          {document.status !== "applied" && document.status !== "archived" && (
            <button onClick={archive} className="flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg" data-testid="button-archive">
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
          <button onClick={apply} disabled={!canApply} className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40" data-testid="button-apply-document">
            <CheckCircle2 className="w-3.5 h-3.5" /> Apply
          </button>
        </div>
      </div>

      {document.lastError && (
        <div className="mb-4 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {document.lastError}
        </div>
      )}
      {document.status === "processing" && isRetryable(document) && (
        <div className="mb-4 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
          Extraction appears stalled (the processing lease expired without completing). You can retry it above.
        </div>
      )}
      {applyError && <div className="mb-4 bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">{applyError}</div>}
      {unresolvedCount > 0 && (
        <div className="mb-4 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
          {unresolvedCount} line(s) still need a confirmed match or must be ignored before this document can be applied.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 600 }}>
          <iframe title="Document proof" src={`/api/commissions/${activeSlug.toLowerCase()}/documents/${documentId}/file`} className="w-full h-full" data-testid="document-preview-frame" />
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Document Total</p>
            <p className="text-lg font-bold text-gray-900">{fmt(document.documentTotal)}</p>
          </div>

          {lines.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              {document.status === "processing" ? "Extraction in progress…" : "No line items extracted."}
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.id} className="bg-white rounded-xl border border-gray-200 p-4" data-testid={`document-line-${line.id}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{line.extractedClientName ?? "(unknown client)"}</p>
                  <span className="text-sm font-bold text-gray-700">{fmt(line.extractedAmount)}</span>
                </div>
                {line.extractedDescription && <p className="text-xs text-gray-400 mt-1">{line.extractedDescription}</p>}
                <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{line.status}</span>

                {(line.status === "unmatched" || line.status === "suggested") && (
                  <LineMatcher slug={activeSlug} documentId={documentId} line={line} onConfirmed={load} />
                )}
                {line.status === "confirmed" && (
                  <AllocationPanel slug={activeSlug} documentId={documentId} line={line} onApplied={load} />
                )}
              </div>
            ))
          )}

          {events.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Audit History</p>
              <div className="space-y-1">
                {events.map((ev) => (
                  <div key={ev.id} className="text-xs text-gray-500 flex justify-between" data-testid={`event-${ev.id}`}>
                    <span>{ev.eventType}{ev.performedBy ? ` · ${ev.performedBy}` : ""}</span>
                    <span className="text-gray-300">{new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </CommissionLayout>
  );
}

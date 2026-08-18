import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionDocument, CommissionDocumentStatus, CommissionDocumentsReadiness } from "@/lib/api";
import { UploadCloud, FileText, AlertTriangle, CheckCircle2, Clock, XCircle, Archive } from "lucide-react";

const STATUS_META: Record<CommissionDocumentStatus, { label: string; color: string; icon: typeof FileText }> = {
  uploaded:        { label: "Uploaded",         color: "text-gray-500 bg-gray-100",     icon: Clock },
  processing:      { label: "Processing",       color: "text-blue-700 bg-blue-50",      icon: Clock },
  needs_review:    { label: "Needs Review",     color: "text-amber-700 bg-amber-50",    icon: AlertTriangle },
  ready_to_apply:  { label: "Ready to Apply",   color: "text-emerald-700 bg-emerald-50", icon: CheckCircle2 },
  applied:         { label: "Applied",          color: "text-emerald-800 bg-emerald-100", icon: CheckCircle2 },
  failed:          { label: "Failed",           color: "text-red-700 bg-red-50",        icon: XCircle },
  archived:        { label: "Archived",         color: "text-gray-400 bg-gray-50",      icon: Archive },
};

const MAX_FILE_SIZE_MB = 25;

/** A short, clear, non-technical explanation for why upload is disabled —
 * never echoes any config detail, just which subsystem is the blocker. */
function readinessBlockerMessage(readiness: CommissionDocumentsReadiness): string | null {
  if (!readiness.databaseReady) return "Document processing is temporarily unavailable (database). Please try again shortly.";
  if (!readiness.objectStorageReady) return "Document processing is temporarily unavailable (storage). Please try again shortly.";
  if (!readiness.aiProviderReady) return "Document processing is not available right now. Please contact an administrator.";
  return null;
}

function StatusBadge({ status }: { status: CommissionDocumentStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`} data-testid={`document-status-${status}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function DocumentRow({ doc }: { doc: CommissionDocument }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(`/commissions/documents/${doc.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between gap-4"
      data-testid={`document-row-${doc.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="w-5 h-5 text-gray-300 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.vendorName ?? doc.fileName}</p>
          <p className="text-xs text-gray-400 truncate">
            {doc.documentNumber ? `${doc.documentNumber} · ` : ""}{doc.fileName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {doc.documentTotal && <span className="text-sm font-semibold text-gray-700">${doc.documentTotal}</span>}
        <StatusBadge status={doc.status} />
      </div>
    </button>
  );
}

export default function CommissionDocumentsPage() {
  const { activeSlug } = useCommissionEntity();
  const [documents, setDocuments] = useState<CommissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [readiness, setReadiness] = useState<CommissionDocumentsReadiness | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    api.commissionDocumentsReadiness(activeSlug)
      .then((res) => {
        if (!active) return;
        const data = (res as { data?: CommissionDocumentsReadiness }).data ?? (res as CommissionDocumentsReadiness);
        setReadiness(data);
      })
      .catch(() => { /* Ready/unready is advisory for the button state — a failed check disables upload safely below via the null-readiness fallback. */ });
    return () => { active = false; };
  }, [activeSlug]);

  // Absent/unknown readiness never defaults to "ready" — the button stays
  // disabled until a successful readiness check says otherwise.
  const blockerMessage = readiness ? readinessBlockerMessage(readiness) : "Checking document processing availability…";
  const uploadDisabled = uploading || blockerMessage !== null;

  const loadDocuments = useCallback(() => {
    mounted.current = true;
    setLoading(true);
    api.commissionDocuments(activeSlug)
      .then((res) => {
        if (!mounted.current) return;
        const data = Array.isArray(res) ? (res as CommissionDocument[]) : ((res as { data?: CommissionDocument[] }).data ?? []);
        setDocuments(data);
        setLoading(false);
      })
      .catch(() => { if (mounted.current) setLoading(false); });
  }, [activeSlug]);

  useEffect(() => {
    loadDocuments();
    return () => { mounted.current = false; };
  }, [loadDocuments]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError(null);

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }
    // Client-side file validation always runs regardless of readiness — only
    // the actual network upload is gated. Never accept a drop while not
    // ready: the disabled button alone doesn't stop drag-and-drop.
    if (uploadDisabled) {
      setUploadError(blockerMessage ?? "Document processing is not available right now.");
      return;
    }

    setUploading(true);
    try {
      await api.uploadCommissionDocument(activeSlug, file);
      loadDocuments();
    } catch (err: unknown) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      if (code === "DUPLICATE_DOCUMENT") {
        setUploadError("This exact document has already been uploaded for this entity.");
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <CommissionLayout title="Commission Documents" subtitle={`${activeSlug} · vendor expense documents`}>
      <div
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragActive ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
        data-testid="document-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-700">Drag a vendor invoice PDF here</p>
        <p className="text-xs text-gray-400 mt-1">or</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDisabled}
          title={blockerMessage ?? undefined}
          className="mt-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          data-testid="button-choose-file"
        >
          {uploading ? "Uploading…" : "Choose a PDF"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          data-testid="input-file"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="text-[11px] text-gray-400 mt-2">PDF only, up to {MAX_FILE_SIZE_MB}MB</p>
        {readiness && blockerMessage && (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mt-3 inline-block" data-testid="upload-not-ready">{blockerMessage}</p>
        )}
        {uploadError && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3 inline-block" data-testid="upload-error">{uploadError}</p>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-400 py-8">Loading…</p>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>
    </CommissionLayout>
  );
}

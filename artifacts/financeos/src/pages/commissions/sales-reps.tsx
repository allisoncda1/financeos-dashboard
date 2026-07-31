import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepresentative, CommissionRunLine } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { UserPlus, House, ExternalLink } from "lucide-react";

function fmt(v: string | null | undefined) { const n = parseFloat(v ?? ""); return isNaN(n) ? "$0.00" : formatCurrency(n); }

function RepCard({ rep, slug, month }: { rep: CommissionRepresentative; slug: string; month: string }) {
  const [, navigate] = useLocation();
  const [lines, setLines]   = useState<CommissionRunLine[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const [y, m] = month.split("-").map(Number);
    api.commissionLines(slug, { representativeId: rep.id, periodYear: y, periodMonth: m, limit: 500 })
      .then(res => {
        if (!mounted.current) return;
        const data = Array.isArray(res) ? (res as CommissionRunLine[]) : ((res as { data?: CommissionRunLine[] }).data ?? []);
        setLines(data);
        setLoading(false);
      })
      .catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [rep.id, slug, month]);

  const approved   = lines.filter(l => l.lineStatus === "approved" || l.lineStatus === "locked");
  const needsAction = lines.filter(l => l.lineStatus === "needs_review" || l.lineStatus === "needs_configuration").length;
  const commTotal  = approved.reduce((a, l) => { const n = parseFloat(l.commissionAmount ?? "0"); return a + (isNaN(n) ? 0 : n); }, 0);

  return (
    <button
      onClick={() => navigate(`/commissions/sales-reps/${rep.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{rep.displayName}</p>
          <p className="text-xs text-gray-400 mt-0.5">External rep · payout eligible</p>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-400 mt-0.5" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xs text-gray-400">Invoices</p><p className="text-sm font-bold text-gray-800">{loading ? "…" : lines.length}</p></div>
        <div><p className="text-xs text-gray-400">Commission</p><p className="text-sm font-bold text-emerald-700">{loading ? "…" : fmt(String(commTotal))}</p></div>
        <div><p className="text-xs text-gray-400">Needs Action</p><p className={`text-sm font-bold ${needsAction > 0 ? "text-amber-600" : "text-gray-400"}`}>{loading ? "…" : needsAction}</p></div>
      </div>
    </button>
  );
}

function AddRepModal({ slug, onClose, onAdded }: { slug: string; onClose: () => void; onAdded: () => void }) {
  const [name, setName]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createCommissionRepresentative(slug, name.trim());
      onAdded();
      onClose();
    } catch (err: unknown) {
      const body = err && typeof err === "object" && "body" in err
        ? (err as { body?: { code?: string; error?: string } }).body : null;
      if (body?.code === "DUPLICATE_SLUG") {
        setError("A representative with that name already exists.");
      } else {
        setError("Failed to add representative. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Add Sales Representative</h2>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Adding a representative does not assign customers or create a commission rate.
          Customer attribution and rates must be configured separately after the rep is created.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Display Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Jason Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              disabled={saving}
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50" disabled={saving}>Cancel</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50" disabled={saving || !name.trim()}>
              {saving ? "Adding…" : "Add Representative"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CommissionSalesRepsPage() {
  const { activeSlug } = useCommissionEntity();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth]       = useState(currentMonth);
  const [reps, setReps]         = useState<CommissionRepresentative[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const mounted = useRef(true);

  function loadReps() {
    mounted.current = true;
    setLoading(true);
    api.commissionRepresentatives(activeSlug)
      .then(res => {
        if (!mounted.current) return;
        const data = Array.isArray(res) ? (res as CommissionRepresentative[]) : ((res as { data?: CommissionRepresentative[] }).data ?? []);
        setReps(data);
        setLoading(false);
      })
      .catch(() => { if (mounted.current) setLoading(false); });
  }

  useEffect(() => {
    loadReps();
    return () => { mounted.current = false; };
  }, [activeSlug]);

  const external = reps.filter(r => r.representativeType === "external_rep");
  const house    = reps.filter(r => r.representativeType === "internal_house");

  return (
    <CommissionLayout title="Sales Representatives" subtitle={`${activeSlug} · ${month}`}>
      {showModal && <AddRepModal slug={activeSlug} onClose={() => setShowModal(false)} onAdded={loadReps} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</label>
          <input type="month" className="border border-gray-200 rounded-md px-3 py-1.5 text-sm" value={month} max={new Date().toISOString().slice(0,7)} onChange={e => { if (e.target.value) setMonth(e.target.value); }} />
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">
          <UserPlus className="w-4 h-4" /> Add Sales Rep
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-400 py-8">Loading…</p> : (
        <>
          {external.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">No external representatives found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {external.map(r => <RepCard key={r.id} rep={r} slug={activeSlug} month={month} />)}
            </div>
          )}

          {house.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">House</p>
              {house.map(r => (
                <div key={r.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                  <House className="w-4 h-4 text-gray-400" />
                  <div><p className="text-sm font-semibold text-gray-700">{r.displayName}</p><p className="text-xs text-gray-400">Internal · no payout</p></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CommissionLayout>
  );
}

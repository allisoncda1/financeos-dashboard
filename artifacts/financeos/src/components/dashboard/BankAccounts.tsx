import type { BankingData } from "@/lib/types";

const PALETTE = ["#003087", "#016FD0", "#5B5BD6", "#0E7490", "#7C3AED", "#059669"];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Props = { banking: BankingData | null };

export function BankAccounts({ banking }: Props) {
  const header = (
    <div className="flex items-center justify-between">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Bank Accounts</p>
    </div>
  );

  if (!banking) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        {header}
        <div className="py-6 text-center text-[12px] text-gray-400">Not available yet</div>
      </div>
    );
  }

  // Hide seed-only / placeholder accounts (no transaction history) so the
  // dashboard summary matches the Banking page's default active view. Legacy /
  // mock payloads without stats keep showing every account.
  const accounts = [...banking.accounts]
    .filter((a) => a.transaction_count === undefined || a.transaction_count > 0)
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {header}

      <div className="space-y-2.5">
        {accounts.length === 0 && (
          <p className="text-[11px] text-gray-400 py-2">No accounts reported.</p>
        )}
        {accounts.map((acct) => {
          const initial = (acct.institution || acct.name || "?").trim().charAt(0).toUpperCase();
          const label = acct.last_four ? `${acct.name} *${acct.last_four}` : acct.name;
          return (
            <div key={acct.id} className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: acct.color || colorFor(acct.institution || acct.name) }}
              >
                <span className="text-white text-[10px] font-bold">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-700 truncate">{label}</p>
              </div>
              <p className="text-[11px] font-semibold text-gray-900 flex-shrink-0">
                ${acct.balance.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600">Total Cash</span>
        <span className="text-[13px] font-bold text-gray-900">
          ${banking.total_cash.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

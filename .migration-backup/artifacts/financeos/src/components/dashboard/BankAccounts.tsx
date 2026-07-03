type BankAccount = {
  name: string;
  mask: string;
  balance: number;
  icon: "chase" | "amex" | "mercury";
};

const ICON_COLORS: Record<BankAccount["icon"], string> = {
  chase:   "#003087",
  amex:    "#016FD0",
  mercury: "#5B5BD6",
};

const ICON_INITIALS: Record<BankAccount["icon"], string> = {
  chase:   "C",
  amex:    "A",
  mercury: "M",
};

type Props = { cashOnHand: number };

export function BankAccounts({ cashOnHand }: Props) {
  const accounts: BankAccount[] = [
    { name: "Chase OpEx",             mask: "*1234", balance: Math.round(cashOnHand * 0.87), icon: "chase" },
    { name: "American Express Bus.",  mask: "*5678", balance: Math.round(cashOnHand * 0.03), icon: "amex" },
    { name: "Mercury Checking",       mask: "*9012", balance: Math.round(cashOnHand * 0.10), icon: "mercury" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Bank Accounts</p>
        <button className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700">
          View All →
        </button>
      </div>

      <div className="space-y-2.5">
        {accounts.map((acct) => (
          <div key={acct.mask} className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: ICON_COLORS[acct.icon] }}
            >
              <span className="text-white text-[10px] font-bold">{ICON_INITIALS[acct.icon]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-gray-700 truncate">
                {acct.name} {acct.mask}
              </p>
            </div>
            <p className="text-[11px] font-semibold text-gray-900 flex-shrink-0">
              ${acct.balance.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600">Total Balance</span>
        <span className="text-[13px] font-bold text-gray-900">
          ${cashOnHand.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

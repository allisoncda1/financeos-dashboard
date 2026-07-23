import { Settings, User, Shield, Sliders, Database, Lock, Cpu, Users } from "lucide-react";
import { useAiStatus } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";


function SectionCard({ title, icon: Icon, iconColor, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}1A` }}>
          <span style={{ color: iconColor, display: "contents" }}><Icon className="w-3.5 h-3.5" /></span>
        </div>
        <h2 className="text-[13px] font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({ label, value, badge }: {
  label: string; value?: string; badge?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-[12px] font-semibold text-gray-800">{value}</span>}
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{badge}</span>
        )}
      </div>
    </div>
  );
}

function UsersAccessCard() {
  const [, navigate] = useLocation();
  return (
    <SectionCard title="Users & Access" icon={Users} iconColor="#6366F1">
      <p className="text-[12px] text-gray-500 leading-relaxed">
        Manage who can access FinanceOS. Invite team members, assign roles, and review pending invitations.
      </p>
      <button
        onClick={() => navigate("/control/users")}
        className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[12px] font-semibold transition-colors"
      >
        <Users className="w-3.5 h-3.5" />
        Manage users &amp; invitations
      </button>
    </SectionCard>
  );
}

function AiPlatformSection() {
  const { data, source } = useAiStatus();
  const loading = source === "loading";
  const failed = source === "unavailable";

  return (
    <SectionCard title="AI Platform" icon={Cpu} iconColor="#10B981">
      {loading && <p className="text-[12px] text-gray-400">Loading AI platform status...</p>}
      {!loading && failed && (
        <p className="text-[12px] text-red-500">Could not reach the AI Platform status endpoint.</p>
      )}
      {!loading && !failed && data && (
        <>
          <SettingRow label="Provider" value={data.provider} />
          <SettingRow label="Model" value={data.model} />
          <SettingRow
            label="Status"
            value={data.available ? "Active" : "Inactive"}
            badge={data.available ? "✓" : undefined}
          />
          <div className="pt-1 border-t border-gray-100 space-y-2.5">
            <SettingRow label="Cache size" value={String(data.cacheStats.size)} />
            <SettingRow label="Cache hits" value={String(data.cacheStats.hits)} />
            <SettingRow label="Cache misses" value={String(data.cacheStats.misses)} />
          </div>
          <div className="mt-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Every AI capability runs server-side through this single provider-abstracted service.
              The frontend never calls an LLM directly, and switching providers requires only a
              configuration change — no code changes needed.
            </p>
          </div>
        </>
      )}
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <Settings className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Settings</h1>
            <p className="text-[11px] text-gray-400">User profile · preferences · security</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-2xl space-y-5">

          {/* User Profile */}
          <SectionCard title="User Profile" icon={User} iconColor="#10B981">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[20px] font-black text-emerald-600">{initials}</span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-gray-900">{user?.name ?? "—"}</p>
                <p className="text-[12px] text-gray-500">{user?.email ?? "—"}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">{user?.role ?? "—"}</p>
              </div>
            </div>
            <SettingRow label="Organization" value="CarDealer.ai / FinanceOS" />
            <SettingRow label="Role"         value={user?.role ?? "—"} />
          </SectionCard>

          {/* Users & Access — admin only */}
          {user?.role === "admin" && <UsersAccessCard />}

          {/* System Preferences */}
          <SectionCard title="System Preferences" icon={Sliders} iconColor="#3B82F6">
            <SettingRow label="Default currency"  value="USD" />
            <SettingRow label="Number format"     value="1,234.56" />
            <SettingRow label="Date format"       value="YYYY-MM-DD" />
            <SettingRow label="Fiscal year start" value="January" />
          </SectionCard>

          {/* Data & Pipeline */}
          <SectionCard title="Data & Pipeline" icon={Database} iconColor="#8B5CF6">
            <SettingRow label="Data source"        value="FinanceOS Core" />
            <SettingRow label="Pipeline frequency" value="Daily at 6:00 AM CT" />
            <SettingRow label="Entities tracked"   value="4" />
          </SectionCard>

          {/* AI Platform */}
          <AiPlatformSection />

          {/* Security */}
          <SectionCard title="Security" icon={Shield} iconColor="#EF4444">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[12px] font-semibold text-emerald-700">No real credentials stored in this app</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              FinanceOS is a read-only presentation layer. No API keys, no QBO tokens,
              no OAuth credentials, and no real financial data are stored in this repository or in the browser.
            </p>
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <SettingRow label="Two-factor authentication" value="Enabled" badge="✓" />
              <SettingRow label="Session timeout"           value="8 hours" />
              <SettingRow label="Last login"                value="2026-07-02 09:41 AM" />
            </div>
          </SectionCard>

          {/* About */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">FinanceOS Dashboard</p>
                <p className="text-[11px] text-gray-400">React · Vite · Tailwind v4</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-300">{user?.email ?? ""}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

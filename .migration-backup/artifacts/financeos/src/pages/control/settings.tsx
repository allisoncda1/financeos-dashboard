import { Settings, User, Shield, Sliders, Bell, Database, Lock, Eye } from "lucide-react";

const USER_PROFILE = {
  name:  "Allison Fabbri",
  email: "allison@cardealer.ai",
  role:  "Portfolio Controller",
  org:   "CarDealer.ai / FinanceOS",
  since: "2026-01-01",
  mfa:   true,
};

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

function SettingRow({ label, value, badge, disabled = true }: {
  label: string; value?: string; badge?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-[12px] font-semibold text-gray-800">{value}</span>}
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{badge}</span>
        )}
        {disabled && (
          <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-wide">Phase 2</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, enabled, note }: { label: string; enabled: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <p className="text-[12px] text-gray-700">{label}</p>
        {note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
      </div>
      <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${enabled ? "bg-emerald-500" : "bg-gray-200"}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <Settings className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Settings</h1>
            <p className="text-[11px] text-gray-400">User profile · preferences · security · Phase 1 read-only</p>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full font-semibold">Phase 1 — Read Only</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl space-y-5">

          {/* User Profile */}
          <SectionCard title="User Profile" icon={User} iconColor="#10B981">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[20px] font-black text-emerald-600">
                  {USER_PROFILE.name.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-gray-900">{USER_PROFILE.name}</p>
                <p className="text-[12px] text-gray-500">{USER_PROFILE.email}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">{USER_PROFILE.role}</p>
              </div>
            </div>
            <SettingRow label="Organization"  value={USER_PROFILE.org}  />
            <SettingRow label="Role"          value={USER_PROFILE.role} badge="Read-only in Phase 1" disabled={false} />
            <SettingRow label="Member since"  value={USER_PROFILE.since} disabled={false} />
            <SettingRow label="Change name"   disabled />
            <SettingRow label="Change email"  disabled />
            <SettingRow label="Change avatar" disabled />
          </SectionCard>

          {/* System Preferences */}
          <SectionCard title="System Preferences" icon={Sliders} iconColor="#3B82F6">
            <Toggle label="Dark mode"              enabled={false} note="Light mode active" />
            <Toggle label="Compact sidebar"        enabled={false} note="Full sidebar shown" />
            <Toggle label="Show entity health dots" enabled={true}  note="Visible in sidebar" />
            <Toggle label="Show badge counts"       enabled={true}  note="Operations inbox badge" />
            <div className="pt-1 border-t border-gray-100 space-y-2.5">
              <SettingRow label="Default currency"      value="USD"     disabled={false} />
              <SettingRow label="Number format"         value="1,234.56" disabled={false} />
              <SettingRow label="Date format"           value="YYYY-MM-DD" disabled={false} />
              <SettingRow label="Fiscal year start"     value="January"  disabled={false} />
              <SettingRow label="Pipeline alert emails" disabled />
              <SettingRow label="Slack notifications"   disabled />
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard title="Notifications" icon={Bell} iconColor="#F59E0B">
            <Toggle label="Pipeline failure alerts"  enabled={false} note="Email on pipeline errors (Phase 2)" />
            <Toggle label="Validation failure digest" enabled={false} note="Daily summary email (Phase 2)" />
            <Toggle label="AR overdue alerts"         enabled={false} note="Push on DSO threshold breach (Phase 2)" />
            <Toggle label="New anomaly detected"      enabled={false} note="In-app notification (Phase 2)" />
            <div className="mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700">
                <span className="font-semibold">Phase 2:</span> Notification routing (email, Slack, push) will be configured after Drive integration is live.
              </p>
            </div>
          </SectionCard>

          {/* Data & Pipeline */}
          <SectionCard title="Data & Pipeline" icon={Database} iconColor="#8B5CF6">
            <SettingRow label="Data source"          value="Mock (Phase 1)"             disabled={false} />
            <SettingRow label="Pipeline frequency"   value="Daily at 6:00 AM CT"        disabled={false} />
            <SettingRow label="Entities tracked"     value="4"                          disabled={false} />
            <SettingRow label="QBO connection"       value="Not connected (Phase 2)"    disabled />
            <SettingRow label="Drive folder ID"      value="Not configured (Phase 2)"   disabled />
            <SettingRow label="Model version"        value="v1.0 (mock)"               disabled={false} />
            <SettingRow label="Trigger manual run"   disabled />
            <SettingRow label="Reset pipeline cache" disabled />
          </SectionCard>

          {/* Security */}
          <SectionCard title="Security" icon={Shield} iconColor="#EF4444">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[12px] font-semibold text-emerald-700">No real credentials stored in this app</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              FinanceOS Phase 1 is a read-only presentation layer. No API keys, no QBO tokens,
              no OAuth credentials, and no real financial data are stored in this repository or in the browser.
            </p>
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <SettingRow label="Two-factor authentication" value="Enabled" badge="✓" disabled={false} />
              <SettingRow label="Session timeout"           value="8 hours" disabled={false} />
              <SettingRow label="Last login"                value="2026-07-02 09:41 AM" disabled={false} />
              <SettingRow label="Change password"           disabled />
              <SettingRow label="Manage sessions"           disabled />
              <SettingRow label="API key management"        disabled />
            </div>
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <Eye className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 leading-relaxed">
                <span className="font-semibold">Phase 2 security note:</span> Server-side credentials (QBO OAuth tokens, Drive service account key)
                will live exclusively in Next.js API route environment variables — never in client components, localStorage, or this repository.
              </p>
            </div>
          </SectionCard>

          {/* About */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">FinanceOS Dashboard</p>
                <p className="text-[11px] text-gray-400">Phase 1 · Mock data · Next.js 15 · Tailwind v4</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">Sprint 5 build</p>
                <p className="text-[10px] text-gray-300">allison@cardealer.ai</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth, type Permission } from "@/lib/auth";
import { Loader2, ShieldAlert } from "lucide-react";

export function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: Permission;
}) {
  const { status, hasPermission } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Redirect to="/login" />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#F4F5F7] text-center px-6">
        <ShieldAlert className="w-8 h-8 text-amber-500" />
        <h1 className="text-[15px] font-semibold text-gray-900">You don't have access to this page</h1>
        <p className="text-[12px] text-gray-500 max-w-sm">
          Ask an administrator to grant you the right role if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

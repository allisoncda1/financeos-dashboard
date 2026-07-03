
import { useState, useEffect } from "react";
import { usePathname } from "@/lib/next-compat";
import { Sidebar } from "./Sidebar";
import { GlobalHeader } from "./GlobalHeader";
import { EntitySelectionProvider } from "@/lib/entity-context";
import { motion, AnimatePresence } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  return (
    <EntitySelectionProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <div
          className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-200 ease-out md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <GlobalHeader onMenuToggle={() => setSidebarOpen(v => !v)} />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </EntitySelectionProvider>
  );
}

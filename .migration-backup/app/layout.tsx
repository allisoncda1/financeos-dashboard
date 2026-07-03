import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CommandBar } from "@/components/layout/CommandBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceOS",
  description: "Portfolio financial intelligence — read-only presentation layer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <CommandBar />
      </body>
    </html>
  );
}

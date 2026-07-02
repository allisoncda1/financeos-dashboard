import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandBar } from "@/components/layout/CommandBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceOS",
  description: "Portfolio financial intelligence — read-only presentation layer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden antialiased">
        <Sidebar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <CommandBar />
      </body>
    </html>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/login" ||
    pathname?.startsWith("/auth") ||
    pathname === "/onboarding" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="px-8 py-6">{children}</div>
      </main>
    </>
  );
}

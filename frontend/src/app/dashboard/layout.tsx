import type { ReactNode } from "react";

import { NoKeyGuard } from "@/components/dashboard/no-key-guard";
import { RequireAuth } from "@/components/dashboard/require-auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main-content" className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
          <RequireAuth>
            <NoKeyGuard>{children}</NoKeyGuard>
          </RequireAuth>
        </main>
      </div>
    </div>
  );
}

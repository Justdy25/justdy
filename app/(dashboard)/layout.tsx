import type { Metadata } from "next";
import { Suspense } from "react";

import { SidebarInset, SidebarProvider } from "@/app/_components/ui/sidebar";
import { AppSidebar } from "../_components/sidebar/dashboard-sidebar";
import { DashboardHeader } from "../_components/sidebar/dashboard-header";

export const metadata: Metadata = {
  title: "Dashboard | Justdy",
  description:
    "Manage your Justdy learning, courses, students, and educational activities.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true} className="min-h-screen bg-slate-50">
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>

      <SidebarInset className="min-h-screen bg-slate-50">
        <DashboardHeader />

        <main className="flex-1 bg-slate-200">
          <div className="mx-auto w-full max-w-[1600px] px-0 py-0 sm:px-0 sm:py-0 lg:px-0 lg:py-0">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

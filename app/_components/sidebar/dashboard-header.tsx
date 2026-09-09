"use client";

import { usePathname } from "next/navigation";

import { SiteHeader } from "./header-welcome";

export function DashboardHeader() {
  const pathname = usePathname();

  // Chat owns the right-side workspace header, so do not render
  // the generic dashboard welcome header there.
  if (pathname === "/chat") {
    return null;
  }

  return <SiteHeader />;
}

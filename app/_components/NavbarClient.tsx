"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronDown,
  Menu,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";

import { ThemeToggle } from "@/app/_components/theme/ThemeToggle";
import { authClient } from "@/lib/auth-client";

import { AuthModal } from "@/app/(auth)/AuthModal";

const resourceLinks = [
  {
    href: "/products",
    title: "Learning Resources",
    description: "Worksheets, workbooks and educational materials",
    icon: BookOpen,
  },
  {
    href: "/tutoring",
    title: "Live Tutoring",
    description: "Book a one-on-one session with a tutor",
    icon: Video,
  },
];

const aiLinks = [
  {
    href: "/dashboard",
    title: "AI Learning Workspace",
    description: "Create and manage educational content with AI",
  },
  {
    href: "/create/worksheet",
    title: "AI Worksheet Creator",
    description: "Generate polished worksheets in minutes",
  },
  {
    href: "/create/quiz",
    title: "AI Quiz Creator",
    description: "Create engaging quizzes with AI",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavbarClient() {
  const pathname = usePathname();

  const {
    data: session,
    isPending: sessionPending,
    refetch: refetchSession,
  } = authClient.useSession();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const openSignin = () => {
    setAuthMode("signin");
    setAuthOpen(true);
    setMobileOpen(false);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setAuthOpen(true);
    setMobileOpen(false);
  };

  /*
   * Keep the navbar synchronized with authentication changes
   * performed inside the authentication modal.
   *
   * Better Auth's useSession() is reactive, but we explicitly
   * refetch when the modal confirms that authentication changed.
   */
  React.useEffect(() => {
    const handleAuthStateChanged = () => {
      void refetchSession();
    };

    window.addEventListener(
      "justdy:auth-state-changed",
      handleAuthStateChanged,
    );

    return () => {
      window.removeEventListener(
        "justdy:auth-state-changed",
        handleAuthStateChanged,
      );
    };
  }, [refetchSession]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 text-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Justdy home"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-200 group-hover:scale-105">
              <Brain className="h-5 w-5" strokeWidth={2.2} />
            </span>

            <span className="flex flex-col leading-none">
              <span className="text-[20px] font-extrabold tracking-tight text-foreground">
                Justdy
              </span>

              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Learn. Grow. Succeed.
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/"
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, "/")
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Home
            </Link>

            <Link
              href="/tutoring"
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(pathname, "/tutoring")
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Tutoring
            </Link>

            {/* Learning resources */}
            <div
              className="relative"
              onMouseEnter={() => setResourcesOpen(true)}
              onMouseLeave={() => setResourcesOpen(false)}
            >
              <button
                type="button"
                className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith("/products")
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setResourcesOpen((value) => !value)}
                aria-expanded={resourcesOpen}
              >
                Learning Resources
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    resourcesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {resourcesOpen && (
                <div className="absolute left-1/2 top-full w-[350px] -translate-x-1/2 pt-3">
                  <div className="rounded-2xl border border-border/80 bg-card p-2 shadow-2xl shadow-foreground/10">
                    {resourceLinks.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
                          onClick={() => setResourcesOpen(false)}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>

                          <span>
                            <span className="block text-sm font-semibold text-foreground">
                              {item.title}
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* AI tools */}
            <div
              className="relative"
              onMouseEnter={() => setAiOpen(true)}
              onMouseLeave={() => setAiOpen(false)}
            >
              <button
                type="button"
                className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  pathname.startsWith("/dashboard") ||
                  pathname.startsWith("/create")
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setAiOpen((value) => !value)}
                aria-expanded={aiOpen}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI Tools
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    aiOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {aiOpen && (
                <div className="absolute left-1/2 top-full w-[370px] -translate-x-1/2 pt-3">
                  <div className="rounded-2xl border border-border/80 bg-card p-2 shadow-2xl shadow-foreground/10">
                    {aiLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-xl p-3 transition-colors hover:bg-muted"
                        onClick={() => setAiOpen(false)}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {item.title}
                        </span>

                        <span className="mt-1 block pl-6 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Pricing
            </Link>

            <Link
              href="/about"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              About
            </Link>
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />

            {!sessionPending &&
              (session ? (
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  AI Workspace
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={openSignin}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Sign in
                  </button>

                  <button
                    type="button"
                    onClick={openSignup}
                    className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </>
              ))}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileOpen && (
          <div className="border-t border-border/60 bg-background lg:hidden">
            <nav className="mx-auto max-w-7xl space-y-1 px-5 py-4 sm:px-6">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Home
              </Link>

              <Link
                href="/tutoring"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <Video className="h-4 w-4 text-primary" />
                Live Tutoring
              </Link>

              <Link
                href="/products"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                Learning Resources
              </Link>

              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                AI Tools
              </Link>

              <Link
                href="/pricing"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Pricing
              </Link>

              <Link
                href="/about"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                About
              </Link>

              {!sessionPending && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                  {session ? (
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
                    >
                      Open AI Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={openSignin}
                        className="rounded-xl border border-border bg-background px-4 py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Sign in
                      </button>

                      <button
                        type="button"
                        onClick={openSignup}
                        className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Get Started
                      </button>
                    </>
                  )}
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Authentication modal */}
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </>
  );
}

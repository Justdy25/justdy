"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Brain,
  ChevronDown,
  Menu,
  Sparkles,
  Video,
  X,
} from "lucide-react";

import { AuthModal } from "@/app/(auth)/AuthModal";
import { ThemeToggle } from "@/app/_components/theme/ThemeToggle";
import { authClient } from "@/lib/auth-client";

import { UserDropdown } from "./UserDropdown";

const navigation = [
  {
    label: "AI Tools",
    items: [
      {
        label: "AI Workspace",
        description: "Create educational content with AI",
        href: "/dashboard",
        icon: Sparkles,
      },
      {
        label: "Worksheets",
        description: "Create worksheets with AI",
        href: "/create/worksheet",
        icon: BookOpen,
      },
      {
        label: "Lessons",
        description: "Build structured lessons",
        href: "/create/lesson",
        icon: Brain,
      },
    ],
  },
  {
    label: "Tutoring",
    items: [
      {
        label: "Find a tutor",
        description: "Book a live tutoring session",
        href: "/tutoring",
        icon: Video,
      },
      {
        label: "My sessions",
        description: "View your tutoring sessions",
        href: "/tutoring/sessions",
        icon: Video,
      },
    ],
  },
];

export default function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const {
    data: session,
    isPending: sessionPending,
    refetch: refetchSession,
  } = authClient.useSession();

  /*
   * SigninModal dispatches this event after a successful login.
   *
   * This is important because MarketingNavbar is the navbar actually
   * rendered by LandingPage. NavbarClient is not the active navbar here.
   */
  useEffect(() => {
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

  const openSignin = () => {
    setAuthMode("signin");
    setAuthOpen(true);
    setMobileOpen(false);
    setOpenMenu(null);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setAuthOpen(true);
    setMobileOpen(false);
    setOpenMenu(null);
  };

  const user = session?.user;

  const userName =
    typeof user?.name === "string" && user.name.trim()
      ? user.name.trim()
      : "User";

  const userEmail = typeof user?.email === "string" ? user.email : "";

  const userImage = typeof user?.image === "string" ? user.image : "";

  const userRole =
    typeof (user as { role?: unknown } | null | undefined)?.role === "string"
      ? ((user as { role?: string }).role ?? "")
      : "";

  /*
   * While Better Auth is determining the session, don't briefly show the
   * logged-out buttons and then replace them with the authenticated UI.
   *
   * This prevents the visible "blink" caused by rendering the wrong
   * authentication state during the initial session request.
   */
  const showAuthenticatedUI = !sessionPending && !!user;
  const showUnauthenticatedUI = !sessionPending && !user;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background text-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => {
              setMobileOpen(false);
              setOpenMenu(null);
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>

            <span className="text-lg font-semibold tracking-tight text-foreground">
              Justdy
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Home
            </Link>

            {navigation.map((menu) => (
              <div key={menu.label} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === menu.label ? null : menu.label)
                  }
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-expanded={openMenu === menu.label}
                >
                  {menu.label}

                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {openMenu === menu.label && (
                  <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-border/80 bg-card p-2 shadow-2xl shadow-foreground/10">
                    {menu.items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className="flex gap-3 rounded-xl p-3 transition hover:bg-muted"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>

                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {item.label}
                            </div>

                            <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <Link
              href="/products"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Resources
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              AI Workspace
            </Link>
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />

            {sessionPending ? (
              /*
               * Keep the authentication area visually stable while
               * Better Auth checks the current session.
               */
              <div
                className="h-10 w-[156px] animate-pulse rounded-xl bg-muted"
                aria-hidden="true"
              />
            ) : showAuthenticatedUI ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  AI Workspace
                </Link>

                <UserDropdown
                  email={userEmail}
                  image={userImage}
                  name={userName}
                  role={userRole}
                />
              </>
            ) : showUnauthenticatedUI ? (
              <>
                <button
                  type="button"
                  onClick={openSignin}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={openSignup}
                  className="group inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  Get started
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              </>
            ) : null}
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />

            {showAuthenticatedUI && (
              <UserDropdown
                email={userEmail}
                image={userImage}
                name={userName}
                role={userRole}
              />
            )}

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <div className="space-y-1 px-6 py-4 sm:px-8">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Home
              </Link>

              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                AI Workspace
              </Link>

              <Link
                href="/tutoring"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Tutoring
              </Link>

              <Link
                href="/products"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Resources
              </Link>

              <div className="mt-3 border-t border-border/60 pt-4">
                {sessionPending ? (
                  <div
                    className="h-11 w-full animate-pulse rounded-xl bg-muted"
                    aria-hidden="true"
                  />
                ) : showAuthenticatedUI ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    Open AI Workspace
                  </Link>
                ) : showUnauthenticatedUI ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={openSignin}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition hover:bg-muted"
                    >
                      Sign in
                    </button>

                    <button
                      type="button"
                      onClick={openSignup}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Get started
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </header>
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </>
  );
}

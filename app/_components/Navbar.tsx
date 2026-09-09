"use client";

import * as React from "react";
import Link from "next/link";
import {
  Menu,
  X,
  BookOpen,
  Video,
  Users,
  Bot,
  LayoutDashboard,
} from "lucide-react";
import clsx from "clsx";

import { AuthModal } from "@/app/(auth)/AuthModal";
import { ThemeToggle } from "@/app/_components/theme/ThemeToggle";
import { authClient } from "@/lib/auth-client";

import MyLogo from "./Logo";
import { UserDropdown } from "./UserDropdown";
import { buttonVariants } from "./ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "./ui/navigation-menu";

const productItems = [
  {
    title: "Courses",
    href: "/courses",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    title: "Live Sessions",
    href: "/live-sessions",
    icon: <Video className="h-4 w-4" />,
  },
  {
    title: "Communities",
    href: "/communities",
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: "AI Tutor",
    href: "/ai-tutor",
    icon: <Bot className="h-4 w-4" />,
  },
];

export function Navbar() {
  const { data: session, isPending } = authClient.useSession();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"signin" | "signup">("signin");

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container relative mx-auto flex min-h-16 items-center px-4 md:px-6 lg:px-8">
          <MyLogo showText clickable className="px-2 py-1.5" />

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center justify-center md:flex">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                {productItems.map((item) => (
                  <NavigationMenuItem key={item.title}>
                    <Link href={item.href}>
                      <NavigationMenuLink
                        className={clsx(
                          navigationMenuTriggerStyle(),
                          "cursor-pointer gap-2 bg-transparent font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground",
                        )}
                      >
                        {item.title}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {!isPending &&
              (session ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/dashboard"
                    className={clsx(
                      buttonVariants({
                        variant: "outline",
                        size: "sm",
                      }),
                      "hidden items-center gap-2 rounded-xl border-border/80 bg-background/60 font-medium transition-colors hover:bg-muted sm:flex",
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>

                  <UserDropdown
                    email={session.user.email ?? ""}
                    image={session.user.image ?? ""}
                    name={session.user.name ?? "User"}
                    role={session.user.role ?? "user"}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuth("signin")}
                  className={clsx(
                    buttonVariants({
                      variant: "default",
                      size: "sm",
                    }),
                    "hidden rounded-xl px-4 sm:inline-flex",
                  )}
                >
                  Sign in
                </button>
              ))}

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
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

        {mobileOpen && (
          <div className="border-t border-border/60 bg-background md:hidden">
            <nav
              className="container mx-auto space-y-1 px-4 py-4"
              aria-label="Mobile navigation"
            >
              {productItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.icon}
                  {item.title}
                </Link>
              ))}

              {session ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => openAuth("signin")}
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Sign in
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuth("signup")}
                    className="rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Get started
                  </button>
                </div>
              )}
            </nav>
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

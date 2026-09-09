"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";

import { AuthModal } from "@/app/(auth)/AuthModal";

const footerGroups = [
  {
    title: "Platform",
    links: [
      { label: "AI Workspace", href: "/dashboard" },
      { label: "Projects", href: "/projects" },
      { label: "Library", href: "/library" },
      { label: "Resources", href: "/products" },
    ],
  },
  {
    title: "Create with AI",
    links: [
      { label: "Worksheets", href: "/create/worksheet" },
      { label: "Lessons", href: "/create/lesson" },
      { label: "Quizzes", href: "/create/quiz" },
      { label: "Video", href: "/create/video" },
    ],
  },
  {
    title: "Tutoring",
    links: [
      { label: "Find a tutor", href: "/tutoring" },
      { label: "Book a session", href: "/tutoring/book" },
      { label: "My sessions", href: "/tutoring/sessions" },
    ],
  },
];

export default function MarketingFooter() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const openSignin = () => {
    setAuthMode("signin");
    setAuthOpen(true);
  };

  const openSignup = () => {
    setAuthMode("signup");
    setAuthOpen(true);
  };

  return (
    <>
      <footer className="border-t border-border bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>

                <span className="text-lg font-semibold tracking-tight">
                  Justdy
                </span>
              </Link>

              <h2 className="mt-7 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
                A smarter way to create, teach, learn, and grow.
              </h2>

              <p className="mt-4 max-w-md text-sm leading-6 text-background/65">
                Justdy is an AI-powered educational ecosystem connecting
                intelligent content creation, learning resources, and live
                tutoring.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 rounded-xl border border-background/10 bg-background/[0.04] px-4 py-3 text-sm text-background/75">
                <Mail className="h-4 w-4 text-primary" />
                Support whenever you need it.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-background">
                    {group.title}
                  </h3>

                  <ul className="mt-4 space-y-3">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm text-background/60 transition hover:text-background"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <h3 className="text-sm font-semibold text-background">
                  Account
                </h3>

                <ul className="mt-4 space-y-3">
                  <li>
                    <button
                      type="button"
                      onClick={openSignin}
                      className="text-sm text-background/60 transition hover:text-background"
                    >
                      Sign in
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={openSignup}
                      className="text-sm text-background/60 transition hover:text-background"
                    >
                      Create account
                    </button>
                  </li>
                  <li>
                    <Link
                      href="/settings"
                      className="text-sm text-background/60 transition hover:text-background"
                    >
                      Settings
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-5 border-t border-background/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-background/45">
              © {new Date().getFullYear()} Justdy. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center gap-5 text-xs text-background/45">
              <Link
                href="/privacy"
                className="transition hover:text-background"
              >
                Privacy
              </Link>

              <Link href="/terms" className="transition hover:text-background">
                Terms
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center gap-1 transition hover:text-background"
              >
                Contact
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </>
  );
}

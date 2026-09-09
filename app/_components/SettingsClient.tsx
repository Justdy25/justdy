"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  CircleHelp,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Props = {
  user: { name: string; email: string; image: string };
};

type Theme = "light" | "dark";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "JU"
  );
}

export default function SettingsClient({ user }: Props) {
  const [saving, setSaving] = React.useState(false);

  const theme = React.useSyncExternalStore(
    React.useCallback((onStoreChange) => {
      const handleThemeChange = () => onStoreChange();
      window.addEventListener("storage", handleThemeChange);
      window.addEventListener("justdy:theme-changed", handleThemeChange);
      return () => {
        window.removeEventListener("storage", handleThemeChange);
        window.removeEventListener("justdy:theme-changed", handleThemeChange);
      };
    }, []),
    React.useCallback((): Theme => {
      return window.localStorage.getItem("justdy-theme") === "dark"
        ? "dark"
        : "light";
    }, []),
    React.useCallback((): Theme => "light", []),
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function changeTheme(next: Theme) {
    window.localStorage.setItem("justdy-theme", next);
    window.dispatchEvent(new Event("justdy:theme-changed"));
  }

  async function signOut() {
    setSaving(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
    setSaving(false);
  }

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Settings
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage your Justdy account and workspace preferences.
          </p>
        </div>

        <section
          id="profile"
          className="scroll-mt-8 rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <UserRound className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Profile</h2>
              <p className="text-xs text-muted-foreground">
                Your account information.
              </p>
            </div>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-sm font-semibold">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                initials(user.name)
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium">
                  {user.name || "Justdy User"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="appearance"
          className="mt-5 scroll-mt-8 rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Palette className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Appearance</h2>
              <p className="text-xs text-muted-foreground">
                Choose how Justdy looks on this device.
              </p>
            </div>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            {[
              {
                value: "light" as const,
                label: "Light",
                icon: Sun,
                description: "Clean and bright.",
              },
              {
                value: "dark" as const,
                label: "Dark",
                icon: Moon,
                description: "Comfortable in low light.",
              },
            ].map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeTheme(option.value)}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                    active
                      ? "border-foreground/30 bg-muted shadow-sm"
                      : "border-border hover:bg-muted/60",
                  ].join(" ")}
                >
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {active && <Check className="size-4" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Account & support</h2>
              <p className="text-xs text-muted-foreground">
                Quick access to account resources.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/70">
            <Link
              href="/credits"
              className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/50 sm:px-6"
            >
              <span className="flex-1 text-sm font-medium">
                Credits & billing
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <a
              href="mailto:support@justdy.com"
              className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/50 sm:px-6"
            >
              <CircleHelp className="size-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Help & support</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </a>
          </div>
        </section>

        <section className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-sm font-semibold">Sign out</p>
            <p className="mt-1 text-xs text-muted-foreground">
              End your current Justdy session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={saving}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border px-3.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
          >
            <LogOut className="size-3.5" />
            {saving ? "Signing out…" : "Sign out"}
          </button>
        </section>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Monitor className="size-3.5" />
          Appearance preference is stored locally on this device.
        </div>
      </div>
    </main>
  );
}

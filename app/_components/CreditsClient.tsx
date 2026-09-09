"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coins,
  CreditCard,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

type Props = {
  userName: string;
};

type CreditPack = {
  name: string;
  credits: number;
  description: string;
  featured?: boolean;
};

const CREDIT_PACKS: CreditPack[] = [
  {
    name: "Starter",
    credits: 100,
    description: "For occasional AI creation and experimentation.",
  },
  {
    name: "Creator",
    credits: 500,
    description: "For regular worksheet, lesson, image, and AI work.",
    featured: true,
  },
  {
    name: "Studio",
    credits: 1200,
    description: "For heavier creative workflows and frequent generation.",
  },
];

function formatCredits(value: number) {
  return new Intl.NumberFormat().format(value);
}

export default function CreditsClient({ userName }: Props) {
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadBalance = React.useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      // /api/ai/chat already returns the authenticated user's credit balance.
      // Reuse that established endpoint instead of introducing a second
      // balance source.
      const response = await fetch("/api/ai/chat", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = (await response.json()) as {
        credits?: { balance?: unknown };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to load your credit balance.");
      }

      const nextBalance = Number(data.credits?.balance ?? 0);

      if (!Number.isFinite(nextBalance)) {
        throw new Error("The credit balance returned by Justdy is invalid.");
      }

      setBalance(nextBalance);
    } catch (loadError) {
      console.error("Failed to load Justdy credits:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your credit balance.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBalance();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBalance]);

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to workspace
          </Link>

          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Usage
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                AI credits
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Credits power AI creation across your Justdy workspace.
                {userName ? ` Welcome back, ${userName.split(" ")[0]}.` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadBalance(true)}
              disabled={refreshing}
              className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-border bg-background px-3.5 text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw
                className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Coins className="size-4 text-primary" />
                </span>
                Available balance
              </div>

              <div className="mt-7 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  {loading ? "—" : formatCredits(balance ?? 0)}
                </span>
                <span className="pb-1.5 text-sm font-medium text-muted-foreground">
                  credits
                </span>
              </div>

              {error ? (
                <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
                  {error}
                </div>
              ) : (
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  Your balance updates as Justdy uses AI for chat, worksheets,
                  lessons, images, video, audio, and other supported generation
                  tasks.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Zap className="size-4 text-primary" />
            </div>

            <h2 className="mt-5 text-sm font-semibold">How credits work</h2>

            <ul className="mt-4 space-y-3">
              {[
                "Different AI actions use different amounts.",
                "Credits are deducted when supported generation work runs.",
                "Your current balance is shown directly from your Justdy AI account.",
              ].map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-xs leading-5 text-muted-foreground"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Credit packs
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">
              Add more credits
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a pack when credit purchasing is connected to your billing
              flow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <article
                key={pack.name}
                className={`relative rounded-2xl border bg-card p-5 shadow-sm transition ${
                  pack.featured
                    ? "border-primary/30 ring-1 ring-primary/10"
                    : "border-border"
                }`}
              >
                {pack.featured && (
                  <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                    Most popular
                  </span>
                )}

                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Sparkles className="size-4" />
                </div>

                <h3 className="mt-5 text-sm font-semibold">{pack.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">
                    {formatCredits(pack.credits)}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>

                <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">
                  {pack.description}
                </p>

                <button
                  type="button"
                  disabled
                  className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-xs font-semibold text-muted-foreground"
                >
                  <CreditCard className="size-3.5" />
                  Purchasing coming soon
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
          <p className="text-xs text-muted-foreground">
            Need to create something now? Your current balance is already
            available in the AI workspace.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground transition hover:text-primary"
          >
            Open AI workspace
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </main>
  );
}

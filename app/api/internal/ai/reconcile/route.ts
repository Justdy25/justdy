import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { reconcileStaleAIGenerations } from "@/lib/ai/generation/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const MAX_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function getConfiguredSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

function hashSecret(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function hasValidAuthorization(request: Request): boolean {
  const configuredSecret = getConfiguredSecret();

  if (!configuredSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) {
    return false;
  }

  const suppliedSecret = authorization.slice(prefix.length).trim();

  if (!suppliedSecret) {
    return false;
  }

  const expectedHash = hashSecret(configuredSecret);
  const suppliedHash = hashSecret(suppliedSecret);

  return expectedHash.equals(suppliedHash);
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), maximum);
}

/**
 * Internal reconciliation trigger.
 *
 * Intended for a trusted scheduler such as Vercel Cron or an external
 * production scheduler. The generation service remains the source of truth;
 * this route only authenticates the trigger and invokes it.
 */
export async function GET(request: Request) {
  if (!hasValidAuthorization(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);

    const staleAfterMs = parsePositiveInteger(
      url.searchParams.get("staleAfterMs"),
      DEFAULT_STALE_AFTER_MS,
      MAX_STALE_AFTER_MS,
    );

    const limit = parsePositiveInteger(
      url.searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const result = await reconcileStaleAIGenerations({
      staleAfterMs,
      limit,
    });

    return NextResponse.json({
      ok: true,
      inspected: result.inspected,
      reconciled: result.reconciled,
      refunded: result.refunded,
      refundPending: result.refundPending,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("AI reconciliation failed:", error);

    return NextResponse.json(
      { error: "AI reconciliation failed." },
      { status: 500 },
    );
  }
}

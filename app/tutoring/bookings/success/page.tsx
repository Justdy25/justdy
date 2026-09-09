"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Loader2,
  Video,
  XCircle,
} from "lucide-react";

type ConfirmationState = "loading" | "success" | "error";

interface ConfirmationResponse {
  success?: boolean;
  booking?: {
    id?: string;
    subject?: string | null;
    gradeLevel?: string | null;
    topic?: string | null;
    amount?: number | null;
    currency?: string | null;
    status?: string | null;
    tutor?: {
      name?: string | null;
    } | null;
    tutoringSlot?: {
      startTime?: string | null;
      endTime?: string | null;
    } | null;
    appointment?: {
      id?: string | null;
      date?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      videoSessionId?: string | null;
    } | null;
  } | null;
  error?: string;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAmount(
  amount?: number | null,
  currency?: string | null,
): string {
  if (typeof amount !== "number") {
    return "";
  }

  const normalizedCurrency = currency?.toUpperCase() || "USD";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

function TutoringBookingSuccessContent() {
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id");

  const [state, setState] = useState<ConfirmationState>(
    sessionId ? "loading" : "error",
  );

  const [message, setMessage] = useState(
    sessionId
      ? "Verifying your payment and preparing your tutoring session…"
      : "We could not verify this checkout session. Please check your tutoring sessions.",
  );

  const [booking, setBooking] = useState<ConfirmationResponse["booking"]>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const checkoutSessionId = sessionId;

    let cancelled = false;

    async function confirmBooking() {
      try {
        const response = await fetch(
          `/api/tutoring/bookings/confirmation?sessionId=${encodeURIComponent(
            checkoutSessionId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = (await response.json()) as ConfirmationResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              "We could not verify your tutoring booking. Please check your tutoring sessions.",
          );
        }

        if (!data.success || !data.booking) {
          throw new Error(
            data.error ||
              "Your payment could not be confirmed yet. Please check your tutoring sessions.",
          );
        }

        if (cancelled) {
          return;
        }

        setBooking(data.booking);
        setMessage(
          "Your payment was confirmed and your tutoring session is ready.",
        );
        setState("success");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "We could not verify your tutoring booking. Please check your tutoring sessions.",
        );
        setState("error");
      }
    }

    void confirmBooking();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
              <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
            </div>

            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
              Confirming your booking
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
              We’re verifying your Stripe payment and making sure your tutoring
              session is ready. This should only take a moment.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-red-200 bg-white p-8 shadow-sm sm:p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
              We couldn’t confirm your booking
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tutoring/sessions"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View my sessions
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/tutoring"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Back to tutoring
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const slot = booking?.tutoringSlot;
  const appointment = booking?.appointment;

  const startTime = appointment?.startTime || slot?.startTime;
  const endTime = appointment?.endTime || slot?.endTime;

  const sessionDate = appointment?.date || startTime;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Booking confirmed
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your tutoring session is booked
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              {message}
            </p>
          </div>

          <div className="border-t border-slate-100 px-6 py-7 sm:px-10">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <CalendarCheck2 className="h-4 w-4" />
                  Session
                </div>

                <div className="mt-3 text-base font-semibold text-slate-950">
                  {booking?.subject || "Tutoring session"}
                </div>

                {booking?.gradeLevel && (
                  <div className="mt-1 text-sm text-slate-500">
                    {booking.gradeLevel}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <Clock3 className="h-4 w-4" />
                  Schedule
                </div>

                <div className="mt-3 text-base font-semibold text-slate-950">
                  {formatDate(sessionDate)}
                </div>

                {(startTime || endTime) && (
                  <div className="mt-1 text-sm text-slate-500">
                    {formatTime(startTime)}
                    {endTime ? ` – ${formatTime(endTime)}` : ""}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Tutor
              </div>

              <div className="mt-2 text-base font-semibold text-slate-950">
                {booking?.tutor?.name || "Your verified tutor"}
              </div>

              {booking?.topic && (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {booking.topic}
                </p>
              )}
            </div>

            {booking?.amount != null && (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-white">
                <span className="text-sm text-slate-300">Paid</span>

                <span className="text-lg font-semibold">
                  {formatAmount(booking.amount, booking.currency)}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-6 py-7 sm:px-10">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                  <Video className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Your live classroom is ready
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Your live video session and shared whiteboard will be
                    available from your tutoring sessions dashboard when the
                    session is ready to join.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tutoring/sessions"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                View my tutoring sessions
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Go to AI Workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SuccessPageFallback() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-600" />

          <p className="mt-4 text-sm text-slate-500">
            Loading booking confirmation…
          </p>
        </div>
      </div>
    </main>
  );
}

export default function TutoringBookingSuccessPage() {
  return (
    <Suspense fallback={<SuccessPageFallback />}>
      <TutoringBookingSuccessContent />
    </Suspense>
  );
}

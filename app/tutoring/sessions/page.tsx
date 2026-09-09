"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Video,
  XCircle,
} from "lucide-react";

type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REFUNDED"
  | string;

type Booking = {
  id: string;
  subject: string;
  gradeLevel: string;
  topic: string | null;
  amount: number;
  currency: string;
  status: BookingStatus;
  appointmentId?: string | null;

  tutoringSlot: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  };

  tutor: {
    id: string;
    name: string;
    imageUrl: string | null;
    facilitatorProfile: {
      specialty: string | null;
      experience?: number | null;
      description?: string | null;
      verificationStatus?: string;
    } | null;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUpcomingStatus(status: BookingStatus) {
  return (
    status === "SCHEDULED" || status === "READY" || status === "IN_PROGRESS"
  );
}

function isPastStatus(status: BookingStatus) {
  return (
    status === "COMPLETED" ||
    status === "NO_SHOW" ||
    status === "CANCELLED" ||
    status === "REFUNDED"
  );
}

function statusLabel(status: BookingStatus) {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "READY":
      return "Ready";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "NO_SHOW":
      return "No show";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    case "PENDING_PAYMENT":
      return "Payment pending";
    case "PAID":
      return "Payment received";
    default:
      return status.replaceAll("_", " ").toLowerCase();
  }
}

function statusClasses(status: BookingStatus) {
  switch (status) {
    case "READY":
    case "IN_PROGRESS":
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";

    case "CANCELLED":
    case "REFUNDED":
    case "NO_SHOW":
      return "bg-red-50 text-red-700";

    case "PENDING_PAYMENT":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getSessionAction(booking: Booking) {
  if (
    booking.status === "SCHEDULED" ||
    booking.status === "READY" ||
    booking.status === "IN_PROGRESS"
  ) {
    return {
      label:
        booking.status === "IN_PROGRESS" ? "Return to session" : "View session",
      joinable: false,
    };
  }

  return null;
}

export default function TutoringSessionsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch("/api/tutoring/bookings", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load tutoring sessions.");
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tutoring sessions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /*
   * Initial load.
   *
   * The timeout prevents the state-updating loader from being invoked
   * synchronously during the effect execution.
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBookings();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadBookings]);

  /*
   * Keep the session list reasonably fresh.
   *
   * This matters when:
   * - Stripe has just completed a booking.
   * - A tutor starts a session.
   * - A tutor completes a session.
   */
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadBookings(true);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadBookings]);

  const upcoming = useMemo(
    () =>
      bookings
        .filter((booking) => isUpcomingStatus(booking.status))
        .sort(
          (a, b) =>
            new Date(a.tutoringSlot.startTime).getTime() -
            new Date(b.tutoringSlot.startTime).getTime(),
        ),
    [bookings],
  );

  const past = useMemo(
    () =>
      bookings
        .filter((booking) => isPastStatus(booking.status))
        .sort(
          (a, b) =>
            new Date(b.tutoringSlot.startTime).getTime() -
            new Date(a.tutoringSlot.startTime).getTime(),
        ),
    [bookings],
  );

  const processing = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "PENDING_PAYMENT" || booking.status === "PAID",
      ),
    [bookings],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-violet-600">My tutoring</p>

            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                Sessions
              </h1>

              {refreshing && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage your live tutoring sessions, join when your session is
              ready, and review completed sessions.
            </p>
          </div>

          <Link
            href="/tutoring"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Book another session
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {loading ? (
          <div className="mt-8 flex justify-center rounded-3xl border border-slate-200 bg-white p-16">
            <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>
                <h2 className="font-semibold text-red-950">
                  Unable to load sessions
                </h2>

                <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={() => void loadBookings(true)}
                  className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {processing.length > 0 && (
              <section className="mt-8">
                <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                  <div className="flex items-start gap-3">
                    <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-violet-600" />

                    <div>
                      <h2 className="font-semibold text-violet-950">
                        Preparing your tutoring session
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-violet-700">
                        Your payment has been received. We are waiting for the
                        tutoring booking to finish processing.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-violet-600" />
                <h2 className="font-semibold">Upcoming</h2>
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming sessions"
                  description="Book a verified tutor when you are ready to learn."
                  action={
                    <Link
                      href="/tutoring"
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Find a tutor
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map((booking) => (
                    <SessionCard key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="mb-4 font-semibold">Past sessions</h2>

              {past.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No completed sessions yet.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {past.map((booking) => (
                    <SessionCard key={booking.id} booking={booking} past />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SessionCard({
  booking,
  past = false,
}: {
  booking: Booking;
  past?: boolean;
}) {
  const start = booking.tutoringSlot.startTime;
  const end = booking.tutoringSlot.endTime;
  const action = getSessionAction(booking);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                booking.status,
              )}`}
            >
              {booking.status === "IN_PROGRESS" ? (
                <Video className="h-3.5 w-3.5" />
              ) : booking.status === "CANCELLED" ||
                booking.status === "REFUNDED" ||
                booking.status === "NO_SHOW" ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}

              {statusLabel(booking.status)}
            </div>

            <h3 className="mt-3 truncate text-lg font-semibold">
              {booking.subject}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {booking.tutor.name} · {booking.gradeLevel}
            </p>
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold">
            {booking.currency.toUpperCase() === "USD"
              ? "$"
              : `${booking.currency.toUpperCase()} `}
            {(booking.amount / 100).toFixed(2)}
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {formatDate(start)}
          </div>

          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-400" />
            {formatTime(start)} – {formatTime(end)}
          </div>

          {booking.topic && (
            <div className="text-slate-500">Topic: {booking.topic}</div>
          )}
        </div>

        {past ? (
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            This tutoring session has ended.
          </div>
        ) : action ? (
          <Link
            href={`/tutoring/sessions/${encodeURIComponent(booking.id)}`}
            className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Video className="h-4 w-4" />
            {action.label}
          </Link>
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
            This booking is still being processed.
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />

      <h3 className="mt-4 font-semibold">{title}</h3>

      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      {action}
    </div>
  );
}

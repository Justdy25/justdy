"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
} from "lucide-react";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
};

type Tutor = {
  id: string;
  name: string;
  imageUrl: string | null;
  facilitatorProfile: {
    specialty: string | null;
    experience: number | null;
    description: string | null;
    verificationStatus: string;
  } | null;
  firstAvailableSlot: Slot | null;
};

const RATE_CENTS_PER_HOUR = 3500;

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

function durationMinutes(slot: Slot) {
  return Math.round(
    (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) /
      60000,
  );
}

function priceFor(slot: Slot) {
  return Math.round((RATE_CENTS_PER_HOUR / 60) * durationMinutes(slot));
}

function TutoringBookContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tutorId = searchParams.get("tutorId") || "";

  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(Boolean(tutorId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tutorId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [tutorResponse, slotsResponse] = await Promise.all([
          fetch("/api/tutoring/tutors", {
            cache: "no-store",
          }),
          fetch(`/api/tutoring/slots?tutorId=${encodeURIComponent(tutorId)}`, {
            cache: "no-store",
          }),
        ]);

        const tutorData = await tutorResponse.json();
        const slotsData = await slotsResponse.json();

        if (!tutorResponse.ok) {
          throw new Error(tutorData?.error || "Unable to load tutor.");
        }

        if (!slotsResponse.ok) {
          throw new Error(slotsData?.error || "Unable to load availability.");
        }

        const found =
          (Array.isArray(tutorData.tutors) ? tutorData.tutors : []).find(
            (item: Tutor) => item.id === tutorId,
          ) || null;

        if (!cancelled) {
          setTutor(found);

          const available = Array.isArray(slotsData.slots)
            ? slotsData.slots.filter(
                (slot: Slot) => slot.status === "Available",
              )
            : [];

          setSlots(available);

          if (available[0]) {
            setSlotId(available[0].id);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load booking details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === slotId) || null,
    [slotId, slots],
  );

  const selectedPrice = selectedSlot ? priceFor(selectedSlot) : 0;

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSlot || !tutor) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tutoring/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tutorId,
          slotId: selectedSlot.id,
          subject,
          gradeLevel,
          topic,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const callback = `${window.location.pathname}${window.location.search}`;

          router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);

          return;
        }

        throw new Error(data?.error || "Unable to create booking.");
      }

      window.location.href = data.checkoutUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create booking.",
      );

      setSubmitting(false);
    }
  }

  if (!tutorId) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-foreground">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/tutoring"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tutors
          </Link>

          <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
            <h1 className="text-xl font-semibold">Select a tutor first</h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Choose a verified tutor before booking a tutoring session.
            </p>

            <Link
              href="/tutoring"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-violet-700"
            >
              Browse tutors
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-20">
        <div className="mx-auto max-w-4xl animate-pulse rounded-3xl bg-card p-8 shadow-sm">
          <div className="h-8 w-64 rounded bg-muted" />

          <div className="mt-6 h-56 rounded-2xl bg-muted/50" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/tutoring"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tutors
        </Link>

        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!tutor ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center">
            <h1 className="text-xl font-semibold">Tutor unavailable</h1>

            <p className="mt-2 text-sm text-muted-foreground">
              This tutor may no longer be accepting bookings.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="rounded-3xl border border-border bg-card p-7 shadow-sm">
              <div className="flex items-center gap-4">
                {tutor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tutor.imageUrl}
                    alt={tutor.name}
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-xl font-semibold text-violet-700">
                    {tutor.name.charAt(0)}
                  </div>
                )}

                <div>
                  <h1 className="text-xl font-semibold">{tutor.name}</h1>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {tutor.facilitatorProfile?.specialty || "General tutoring"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Verified tutor
              </div>

              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {tutor.facilitatorProfile?.description ||
                  "A verified Justdy tutor ready to help you."}
              </p>

              <div className="mt-7 rounded-2xl bg-background p-5 text-foreground">
                <div className="text-sm text-muted-foreground">
                  Session rate
                </div>

                <div className="mt-1 text-2xl font-semibold">
                  $35
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / hour
                  </span>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Calculated from the selected slot duration.
                </div>
              </div>
            </aside>

            <form
              onSubmit={submitBooking}
              className="rounded-3xl border border-border bg-card p-7 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-violet-600">
                  Book your session
                </p>

                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  Choose a time and tell your tutor what you need
                </h2>
              </div>

              <div className="mt-7">
                <label className="text-sm font-medium">Available times</label>

                {slots.length === 0 ? (
                  <div className="mt-3 rounded-2xl bg-background p-5 text-sm text-muted-foreground">
                    There are no upcoming slots for this tutor.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {slots.map((slot) => (
                      <label
                        key={slot.id}
                        className={`cursor-pointer rounded-2xl border p-4 transition ${
                          slot.id === slotId
                            ? "border-violet-500 bg-violet-50"
                            : "border-border hover:border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={slot.id}
                          checked={slot.id === slotId}
                          onChange={() => setSlotId(slot.id)}
                          className="sr-only"
                        />

                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CalendarDays className="h-4 w-4 text-violet-600" />

                          {formatDate(slot.startTime)}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock3 className="h-4 w-4" />
                          {formatTime(slot.startTime)} –{" "}
                          {formatTime(slot.endTime)}
                        </div>

                        <div className="mt-2 text-sm font-medium">
                          ${(priceFor(slot) / 100).toFixed(2)}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Subject
                  <input
                    required
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="e.g. Mathematics"
                    className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </label>

                <label className="text-sm font-medium">
                  Grade / level
                  <input
                    required
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                    placeholder="e.g. Grade 6"
                    className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-medium">
                Topic{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="What would you like to work on?"
                  className="mt-2 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>

              <label className="mt-4 block text-sm font-medium">
                Message for your tutor{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Share goals, questions, or anything your tutor should know."
                  className="mt-2 w-full resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>

              <div className="mt-7 flex items-center justify-between rounded-2xl bg-background p-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    You pay today
                  </div>

                  <div className="mt-1 text-xl font-semibold">
                    ${(selectedPrice / 100).toFixed(2)}
                  </div>
                </div>

                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    {selectedSlot ? durationMinutes(selectedSlot) : 0} minutes
                  </div>

                  <div>Secure Stripe checkout</div>
                </div>
              </div>

              <button
                disabled={!selectedSlot || submitting || slots.length === 0}
                type="submit"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-background px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing secure checkout…
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Continue to secure payment
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                After payment, your live video session and shared whiteboard are
                created automatically.
              </p>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function TutoringBookFallback() {
  return (
    <main className="min-h-screen bg-background px-6 py-20">
      <div className="mx-auto max-w-4xl animate-pulse rounded-3xl bg-card p-8 shadow-sm">
        <div className="h-5 w-32 rounded bg-muted" />

        <div className="mt-8 h-8 w-64 rounded bg-muted" />

        <div className="mt-6 h-56 rounded-2xl bg-muted/50" />
      </div>
    </main>
  );
}

export default function TutoringBookPage() {
  return (
    <Suspense fallback={<TutoringBookFallback />}>
      <TutoringBookContent />
    </Suspense>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  Pencil,
  Video,
  XCircle,
} from "lucide-react";

import dynamic from "next/dynamic";

const VideoCall = dynamic(() => import("@/app/_components/VideoCall"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-background text-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
    </div>
  ),
});

const Whiteboard = dynamic(() => import("@/app/_components/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl bg-card">
      <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
    </div>
  ),
});

type SessionData = {
  id: string;
  bookingId: string;
  appointmentId: string | null;
  role: "customer" | "tutor";

  subject: string;
  gradeLevel: string;
  topic: string | null;
  description: string | null;

  amount: number;
  currency: string;
  status: string;

  startTime: string;
  endTime: string;

  appointmentStatus: string | null;

  videoSessionAvailable: boolean;

  canJoin: boolean;
  beforeJoinWindow: boolean;
  afterSession: boolean;
  joinWindowStart: string;

  tutor: {
    id: string;
    name: string;
    imageUrl: string | null;
  };

  customer: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
};

type VideoCredentials = {
  videoSessionId: string;
  token: string;
  role: "customer" | "tutor";
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
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

function formatCountdown(value: string) {
  const target = new Date(value).getTime();
  const difference = target - Date.now();

  if (difference <= 0) {
    return "Available now";
  }

  const totalMinutes = Math.ceil(difference / 60000);

  if (totalMinutes < 60) {
    return `Available in ${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);

  const minutes = totalMinutes % 60;

  return minutes > 0
    ? `Available in ${hours}h ${minutes}m`
    : `Available in ${hours}h`;
}

export default function TutoringSessionRoom({
  bookingId,
}: {
  bookingId: string;
}) {
  const [session, setSession] = useState<SessionData | null>(null);

  const [videoCredentials, setVideoCredentials] =
    useState<VideoCredentials | null>(null);

  const [loading, setLoading] = useState(true);

  const [joining, setJoining] = useState(false);

  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/tutoring/sessions/${encodeURIComponent(bookingId)}`,
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load tutoring session.");
      }

      setSession(data.session);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tutoring session.",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSession]);

  /*
   * Refresh the session state while waiting for
   * the 30-minute join window.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSession]);

  const otherParticipant = useMemo(() => {
    if (!session) {
      return null;
    }

    return session.role === "tutor" ? session.customer : session.tutor;
  }, [session]);

  async function joinSession() {
    if (joining || !session || !session.canJoin || !session.appointmentId) {
      return;
    }

    setJoining(true);
    setError("");

    try {
      const response = await fetch(
        `/api/tutoring/sessions/${encodeURIComponent(bookingId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to join the tutoring session.");
      }

      setVideoCredentials({
        videoSessionId: data.videoSessionId,
        token: data.token,
        role: data.role,
      });
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join the tutoring session.",
      );
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          Loading tutoring session…
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/tutoring/sessions"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sessions
          </Link>

          <div className="mt-8 rounded-3xl border border-destructive/30 bg-destructive/10 p-8">
            <XCircle className="h-7 w-7 text-destructive" />

            <h1 className="mt-4 text-xl font-semibold text-destructive">
              Unable to load session
            </h1>

            <p className="mt-2 text-sm text-destructive">
              {error || "This tutoring session could not be found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (videoCredentials) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border/50 bg-background px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/tutoring/sessions"
              className="rounded-xl p-2 text-muted-foreground hover:bg-card/10 hover:text-foreground"
              aria-label="Back to sessions"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <div className="text-sm font-semibold">{session.subject}</div>

              <div className="text-xs text-muted-foreground">
                {otherParticipant?.name}
                {" · "}
                {session.role === "tutor" ? "Tutor" : "Customer"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live classroom
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[1.2fr_1fr]">
          <section className="min-h-[520px] border-b border-border/50 lg:border-b-0 lg:border-r">
            <VideoCall
              sessionId={videoCredentials.videoSessionId}
              token={videoCredentials.token}
              role={videoCredentials.role === "tutor" ? "educator" : "student"}
            />
          </section>

          <section className="min-h-[520px] bg-muted/50 p-3">
            {session.appointmentId ? (
              <div className="h-full overflow-hidden rounded-2xl border border-border bg-card">
                <Whiteboard
                  mode="appointment"
                  appointmentId={session.appointmentId}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl bg-card text-sm text-muted-foreground">
                Whiteboard is not available for this session.
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/tutoring/sessions"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sessions
        </Link>

        {error && (
          <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
                  <Video className="h-4 w-4" />
                  Live tutoring session
                </div>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  {session.subject}
                </h1>

                <p className="mt-2 text-muted-foreground">
                  {session.topic || `${session.gradeLevel} tutoring`}
                </p>
              </div>

              <div className="rounded-2xl bg-muted/50 px-4 py-3 text-right">
                <div className="text-xs text-muted-foreground">Session</div>

                <div className="mt-1 text-sm font-semibold">
                  {session.status}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-background p-5">
                <CalendarDays className="h-5 w-5 text-violet-600" />

                <div className="mt-3 text-xs text-muted-foreground">Date</div>

                <div className="mt-1 font-semibold">
                  {formatDate(session.startTime)}
                </div>
              </div>

              <div className="rounded-2xl bg-background p-5">
                <Clock3 className="h-5 w-5 text-violet-600" />

                <div className="mt-3 text-xs text-muted-foreground">Time</div>

                <div className="mt-1 font-semibold">
                  {formatTime(session.startTime)} –{" "}
                  {formatTime(session.endTime)}
                </div>
              </div>
            </div>

            {session.description && (
              <div className="mt-6 rounded-2xl border border-border p-5">
                <div className="text-sm font-semibold">
                  Message for the tutor
                </div>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {session.description}
                </p>
              </div>
            )}

            <div className="mt-8 rounded-3xl bg-background p-6 text-foreground">
              {session.beforeJoinWindow ? (
                <>
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-5 w-5 text-violet-400" />

                    <div>
                      <div className="font-semibold">
                        Your classroom is not open yet
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatCountdown(session.joinWindowStart)}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    The live classroom becomes available 30 minutes before your
                    scheduled tutoring session.
                  </p>
                </>
              ) : session.afterSession ? (
                <>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />

                    <div>
                      <div className="font-semibold">
                        This session has ended
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        Thank you for using Justdy tutoring.
                      </div>
                    </div>
                  </div>
                </>
              ) : session.canJoin ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
                      <Video className="h-5 w-5 text-emerald-400" />
                    </div>

                    <div>
                      <div className="font-semibold">
                        Your classroom is ready
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        Join your live video classroom and shared whiteboard.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={joinSession}
                    disabled={joining}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4" />
                        Join live session
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <LockKeyhole className="h-5 w-5 text-muted-foreground" />

                    <div>
                      <div className="font-semibold">Session unavailable</div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        This classroom is not currently available.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">
                {session.role === "tutor" ? "Customer" : "Your tutor"}
              </div>

              <div className="mt-4 flex items-center gap-4">
                {otherParticipant?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={otherParticipant.imageUrl}
                    alt={otherParticipant.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-lg font-semibold text-violet-700">
                    {otherParticipant?.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="font-semibold">{otherParticipant?.name}</div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmed participant
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Pencil className="h-4 w-4 text-violet-600" />
                Shared classroom
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                During the live session, both participants can work from the
                same shared whiteboard.
              </p>

              <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Live video and audio
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Shared whiteboard
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Private session access
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Session details
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Grade</span>

                  <span className="font-medium">{session.gradeLevel}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Amount</span>

                  <span className="font-medium">
                    ${(session.amount / 100).toFixed(2)}
                  </span>
                </div>

                {session.topic && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Topic</span>

                    <span className="text-right font-medium">
                      {session.topic}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

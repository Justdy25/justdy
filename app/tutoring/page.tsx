"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Search,
  Sparkles,
  Video,
} from "lucide-react";

type TutorSlot = {
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
  firstAvailableSlot: TutorSlot | null;
};

const RATE_CENTS_PER_HOUR = 3500;

function formatSlot(slot: TutorSlot | null) {
  if (!slot) return "No upcoming availability";
  const start = new Date(slot.startTime);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export default function TutoringPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTutors() {
      try {
        const response = await fetch("/api/tutoring/tutors", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data?.error || "Unable to load tutors.");
        if (!cancelled)
          setTutors(Array.isArray(data.tutors) ? data.tutors : []);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load tutors.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTutors();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTutors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tutors;

    return tutors.filter((tutor) => {
      const profile = tutor.facilitatorProfile;
      return [tutor.name, profile?.specialty, profile?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [search, tutors]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
              <Sparkles className="h-4 w-4" />
              Live tutoring on Justdy
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Learn directly with a tutor who can teach with you, not just to
              you.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Book a private live session, meet by video, and work together on a
              shared whiteboard in real time.
            </p>
          </div>

          <div className="mt-10 flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tutors by name or specialty"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [Video, "Live video", "Talk face-to-face with your tutor."],
            [
              GraduationCap,
              "Expert guidance",
              "Learn from verified tutors with real experience.",
            ],
            [
              CheckCircle2,
              "Shared whiteboard",
              "Work through problems together in the same workspace.",
            ],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Video;
            return (
              <div
                key={String(title)}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <FeatureIcon className="h-5 w-5 text-violet-600" />
                <h2 className="mt-4 font-semibold">{String(title)}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {String(description)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-violet-600">
              Verified tutors
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Choose someone to learn with
            </h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
            <Clock3 className="h-4 w-4" />
            Sessions from ${RATE_CENTS_PER_HOUR / 100}/hour
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : filteredTutors.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-4 font-semibold">No tutors found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try another name or specialty.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredTutors.map((tutor) => {
              const profile = tutor.facilitatorProfile;
              return (
                <article
                  key={tutor.id}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {tutor.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tutor.imageUrl}
                          alt={tutor.name}
                          className="h-14 w-14 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-lg font-semibold text-violet-700">
                          {tutor.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold">
                            {tutor.name}
                          </h3>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {profile?.specialty || "General tutoring"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-5 line-clamp-3 min-h-18 text-sm leading-6 text-slate-600">
                      {profile?.description ||
                        "Verified Justdy tutor ready to help you work through your goals."}
                    </p>

                    <div className="mt-5 flex items-center gap-4 text-xs text-slate-500">
                      {typeof profile?.experience === "number" && (
                        <span>{profile.experience} years experience</span>
                      )}
                      <span className="font-medium text-slate-700">
                        ${RATE_CENTS_PER_HOUR / 100}/hr
                      </span>
                    </div>

                    <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm">
                      <CalendarDays className="h-4 w-4 text-violet-600" />
                      <span className="text-slate-600">
                        {formatSlot(tutor.firstAvailableSlot)}
                      </span>
                    </div>

                    <Link
                      href={`/tutoring/book?tutorId=${encodeURIComponent(tutor.id)}`}
                      className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                    >
                      View availability
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

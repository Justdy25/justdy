"use client";

import { LockKeyhole, Palette } from "lucide-react";

export type WorksheetDesign = {
  template: "classic" | "modern" | "playful" | "assessment";
  layoutMode?: "auto" | "manual";
  density: "compact" | "comfortable" | "spacious";
  titleStyle: "boxed" | "underline" | "plain";
  accentColor: string;
  borderColor: string;
  headerFields: "all" | "name-date" | "name-date-score";
  answerSpace: "small" | "medium" | "large";
  questionLayout: "single" | "two-column";
  decorations: "none" | "minimal" | "playful";
};

export const DEFAULT_WORKSHEET_DESIGN: WorksheetDesign = {
  template: "classic",
  layoutMode: "auto",
  density: "comfortable",
  titleStyle: "boxed",
  accentColor: "#334155",
  borderColor: "#cbd5e1",
  headerFields: "name-date-score",
  answerSpace: "medium",
  questionLayout: "single",
  decorations: "none",
};

interface WorksheetDesignPanelProps {
  value: WorksheetDesign;
  onChange?: (value: WorksheetDesign) => void;
  onReset?: () => void;
}

function LockedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-3 py-2.5">
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-right text-[11px] font-medium text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

export default function WorksheetDesignPanel({
  value,
}: WorksheetDesignPanelProps) {
  const layout = value.layoutMode ?? "auto";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Palette className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Worksheet design</h2>
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                <LockKeyhole className="h-2.5 w-2.5" /> Locked
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              The worksheet layout is finalized. We are keeping this version
              stable while the answer key is being refined.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Locked layout
            </h3>
            <LockedRow
              label="Layout mode"
              value={layout === "auto" ? "Automatic" : "Manual"}
            />
            <LockedRow label="Visual style" value="Classic — clean classroom" />
            <LockedRow label="Question density" value="Comfortable" />
            <LockedRow label="Question layout" value="Single column" />
            <LockedRow
              label="Short-answer space"
              value="Medium • clean blank workspace"
            />
            <LockedRow label="Title treatment" value="Designed box" />
            <LockedRow label="Student fields" value="Name + Date + Score" />
            <LockedRow label="Decorations" value="None — printer friendly" />
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Colors
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Accent
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-6 w-6 rounded-md border"
                    style={{ background: value.accentColor }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {value.accentColor}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Border
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-6 w-6 rounded-md border"
                    style={{ background: value.borderColor }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {value.borderColor}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-xl border bg-primary/[0.04] p-3.5">
            <div className="flex gap-2.5">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold">
                  Worksheet settings are frozen
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  No layout controls will be changed from this point forward.
                  Future work is focused on the answer key and document quality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-muted/20 p-4">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" />
          Layout locked
        </div>
      </div>
    </div>
  );
}

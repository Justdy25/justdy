"use client";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

import WorksheetPages from "./WorksheetPages";

interface WorksheetPreviewProps {
  worksheet: WorksheetDocument;
}

export default function WorksheetPreview({ worksheet }: WorksheetPreviewProps) {
  return (
    <div className="h-full overflow-auto bg-slate-200/70 p-8">
      <WorksheetPages worksheet={worksheet} />
    </div>
  );
}

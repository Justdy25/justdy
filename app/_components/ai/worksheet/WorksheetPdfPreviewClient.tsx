"use client";

import dynamic from "next/dynamic";

const WorksheetPdfPreview = dynamic(() => import("./WorksheetPdfPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        Loading PDF preview…
      </div>
    </div>
  ),
});

export default WorksheetPdfPreview;

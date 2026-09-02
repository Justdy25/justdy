"use client";

import dynamic from "next/dynamic";

export interface PdfPreviewProps {
  src: string;
  className?: string;
  showAllPages?: boolean;
  zoom?: number;
}

const PdfPreviewClient = dynamic<PdfPreviewProps>(
  () => import("./PdfPreviewClient").then((module) => module.PdfPreviewClient),
  {
    ssr: false,

    loading: () => (
      <div className="flex h-full min-h-50 w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-7 animate-spin rounded-full border-2 border-muted border-t-primary" />

          <div>
            <p className="text-sm font-medium">Loading document...</p>

            <p className="mt-1 text-xs text-muted-foreground">
              Preparing PDF preview
            </p>
          </div>
        </div>
      </div>
    ),
  },
);

export function PdfPreview(props: PdfPreviewProps) {
  return <PdfPreviewClient {...props} />;
}

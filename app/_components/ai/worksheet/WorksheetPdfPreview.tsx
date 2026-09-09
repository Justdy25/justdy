"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AlertCircle, Loader2 } from "lucide-react";

import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { WorksheetDesign } from "@/lib/ai/worksheet/worksheet-design";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const LETTER_WIDTH_PX = 816;

interface WorksheetPdfPreviewProps {
  worksheet: WorksheetDocument | null;
  design: WorksheetDesign;
  containerRef: React.RefObject<HTMLDivElement | null>;
  manualZoom: number | null;
  onFitZoom: (zoom: number) => void;
  onZoomChange: (zoom: number | null) => void;
}

export default function WorksheetPdfPreview({
  worksheet,
  design,
  containerRef,
  manualZoom,
  onFitZoom,
  onZoomChange,
}: WorksheetPdfPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitZoom, setFitZoom] = useState(0.75);
  const requestIdRef = useRef(0);

  const requestPayload = useMemo(
    () =>
      worksheet
        ? JSON.stringify({
            worksheet,
            type: "worksheet",
            design,
          })
        : "",
    [worksheet, design],
  );

  useEffect(() => {
    if (!worksheet) {
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadPreviewPdf() {
      setLoading(true);
      setError(null);
      setNumPages(0);

      try {
        const response = await fetch("/api/ai/worksheet/pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestPayload,
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Unable to render worksheet preview.");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (requestId !== requestIdRef.current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPdfUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      } catch (previewError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }

        setPdfUrl(null);
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to render worksheet preview.",
        );
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    const debounceTimer = window.setTimeout(() => {
      loadPreviewPdf();
    }, 250);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [requestPayload, worksheet]);

  const calculateFitZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const availableWidth = Math.max(280, container.clientWidth - 48);
    const nextFitZoom = Math.min(1, availableWidth / LETTER_WIDTH_PX);

    setFitZoom(Math.max(nextFitZoom, 0.45));
    const nextZoom = Math.max(nextFitZoom, 0.45);
    onFitZoom(nextZoom);
    onZoomChange(nextZoom);
  }, [containerRef, onFitZoom, onZoomChange]);

  useEffect(() => {
    if (!pdfUrl) {
      return;
    }

    calculateFitZoom();

    const observer = new ResizeObserver(() => {
      if (manualZoom === null) {
        calculateFitZoom();
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pdfUrl, manualZoom, calculateFitZoom, containerRef]);

  function handleDocumentLoadSuccess(pdf: PDFDocumentProxy) {
    setNumPages(pdf.numPages);
  }

  if (!worksheet) {
    return null;
  }

  const zoom = manualZoom ?? fitZoom;
  const pageWidth = Math.round(LETTER_WIDTH_PX * zoom);

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden px-5 pb-24 pt-6 sm:px-8 sm:pt-8">
      {loading && !pdfUrl && (
        <div className="flex min-h-[520px] items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">Updating preview…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rendering the exact PDF layout.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Preview unavailable</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {pdfUrl && (
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={null}
          error={null}
          className="flex flex-col items-center gap-7"
        >
          {Array.from({ length: numPages }, (_, index) => (
            <div
              key={`${pdfUrl}-${index + 1}`}
              className="relative shrink-0 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
            >
              <Page
                pageNumber={index + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={
                  <div
                    style={{
                      width: pageWidth,
                      height: Math.round(pageWidth * 1.2941),
                    }}
                    className="flex items-center justify-center bg-white"
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                }
              />
            </div>
          ))}
        </Document>
      )}

      {pdfUrl && numPages > 0 && (
        <div className="mt-5 text-center text-[11px] font-medium text-muted-foreground">
          {numPages} {numPages === 1 ? "page" : "pages"}
          {loading ? " • updating…" : ""}
        </div>
      )}
    </div>
  );
}

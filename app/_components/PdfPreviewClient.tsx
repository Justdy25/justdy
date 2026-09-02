"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, Loader2 } from "lucide-react";

export interface PdfPreviewProps {
  src: string;
  className?: string;
  showAllPages?: boolean;
  zoom?: number;
}

// ============================================================
// PDF.JS WORKER
// ============================================================

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfPreviewClient({
  src,
  className = "",
  showAllPages = false,
  zoom = 1,
}: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // STATE
  // ============================================================

  const [containerWidth, setContainerWidth] = useState(0);

  const [numPages, setNumPages] = useState<number | null>(null);

  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  // ============================================================
  // RESPONSIVE CONTAINER WIDTH
  // ============================================================

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const updateWidth = () => {
      const width = Math.floor(element.clientWidth);

      setContainerWidth((previousWidth) => {
        if (previousWidth === width) {
          return previousWidth;
        }

        return width;
      });
    };

    const frame = requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // ============================================================
  // PDF LOAD SUCCESS
  // ============================================================

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadedSrc(src);

    setErrorSrc((current) => (current === src ? null : current));
  };

  // ============================================================
  // PDF LOAD ERROR
  // ============================================================

  const handleLoadError = (error: Error) => {
    console.error("PDF preview error:", error);

    setErrorSrc(src);
    setLoadedSrc(null);
    setNumPages(null);
  };

  // ============================================================
  // STATUS
  // ============================================================

  const isLoaded = loadedSrc === src;

  const hasError = errorSrc === src;

  // ============================================================
  // LARGE PREVIEW SPACING
  // ============================================================
  //
  // showAllPages=true is being used by your large PDF viewer.
  //
  // Therefore:
  //
  // Small card:
  //   showAllPages=false
  //   -> NO additional padding
  //
  // Large modal:
  //   showAllPages=true
  //   -> top + bottom breathing room
  //
  // ============================================================

  const isLargePreview = showAllPages;

  const horizontalPadding = isLargePreview ? 48 : 0;

  // ============================================================
  // AVAILABLE PDF WIDTH
  // ============================================================
  //
  // clientWidth includes the content box available to the
  // component. For the large preview we reserve horizontal
  // breathing room before calculating the PDF width.
  //
  // ============================================================

  const availableWidth = Math.max(1, containerWidth - horizontalPadding);

  // ============================================================
  // BASE PAGE WIDTH
  // ============================================================

  const basePageWidth = Math.min(availableWidth, 900);

  // ============================================================
  // ZOOMED PAGE WIDTH
  // ============================================================

  const safeZoom = Math.max(0.5, Math.min(3, zoom));

  const pageWidth = Math.max(1, Math.round(basePageWidth * safeZoom));

  const isZoomed = safeZoom !== 1;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      ref={containerRef}
      className={`
        relative
        h-full
        w-full
        overflow-auto
        ${className}
      `}
    >
      {/* ========================================================
          ERROR
      ======================================================== */}

      {hasError ? (
        <div
          className="
            flex
            h-full
            min-h-75
            flex-col
            items-center
            justify-center
            gap-4
            p-6
            text-center
          "
        >
          <div
            className="
              flex
              size-14
              items-center
              justify-center
              rounded-full
              bg-muted
            "
          >
            <FileText className="size-7 text-muted-foreground" />
          </div>

          <div>
            <p className="text-sm font-semibold">Unable to preview this PDF</p>

            <p className="mt-1 text-xs text-muted-foreground">
              The document could not be rendered.
            </p>
          </div>

          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="
              text-xs
              font-semibold
              text-primary
              hover:underline
            "
          >
            Open PDF in new tab
          </a>
        </div>
      ) : (
        <>
          {/* ======================================================
              LOADING
          ====================================================== */}

          {!isLoaded && (
            <div
              className="
                absolute
                inset-0
                z-20
                flex
                items-center
                justify-center
                bg-background
              "
            >
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-3
                  text-center
                "
              >
                <Loader2
                  className="
                    size-7
                    animate-spin
                    text-primary
                  "
                />

                <div>
                  <p className="text-sm font-medium">Loading document...</p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-muted-foreground
                    "
                  >
                    Preparing PDF preview
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================
              PDF DOCUMENT
          ====================================================== */}

          <Document
            key={src}
            file={src}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={null}
            error={null}
            className="
              m-0
              p-0
            "
          >
            {containerWidth > 0 &&
              isLoaded &&
              numPages !== null &&
              (showAllPages ? (
                /* ==================================================
                     LARGE PREVIEW — ALL PAGES
                  ================================================== */

                <div
                  className={`
                    m-0
                    flex
                    w-full
                    flex-col
                    items-center
                    gap-6
                    px-6
                    pt-5
                    pb-5

                    ${isZoomed ? "min-w-max" : ""}
                  `}
                >
                  {Array.from({ length: numPages }, (_, index) => (
                    <div
                      key={`page-${index + 1}`}
                      className="
                          m-0
                          shrink-0
                          overflow-hidden
                          bg-white
                          shadow-[0_18px_60px_rgba(0,0,0,0.22)]
                        "
                    >
                      <Page
                        pageNumber={index + 1}
                        width={pageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="
                            m-0
                            block
                            p-0
                          "
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* ==================================================
                     SMALL CARD PREVIEW — FIRST PAGE
                  ================================================== */

                <div
                  className={`
                    m-0
                    flex
                    w-full
                    justify-center
                    p-0

                    ${isZoomed ? "min-w-max" : ""}
                  `}
                >
                  <div
                    className="
                      m-0
                      shrink-0
                      overflow-hidden
                      bg-white
                      shadow-[0_18px_60px_rgba(0,0,0,0.22)]
                    "
                  >
                    <Page
                      pageNumber={1}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="
                        m-0
                        block
                        p-0
                      "
                    />
                  </div>
                </div>
              ))}
          </Document>
        </>
      )}
    </div>
  );
}

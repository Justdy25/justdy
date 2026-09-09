"use client";

import { useEffect, useState } from "react";

import { Download, FileText, X, ZoomIn, ZoomOut } from "lucide-react";

import { PdfPreview } from "./PdfPreview";
import Image from "next/image";

interface ResourcePreviewCardProps {
  title: string;
  description: string;
  type: string;
  isPdf: boolean;
  pdfPreviewUrl?: string | null;
  imageUrl?: string;
  softClass?: string;
}

export function ResourcePreviewCard({
  title,
  description,
  type,
  isPdf,
  pdfPreviewUrl,
  imageUrl,
  softClass = "bg-blue-50",
}: ResourcePreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  /*
   * Zoom level for the large viewer.
   *
   * 1   = 100%
   * 1.1 = 110%
   * 1.2 = 120%
   * etc.
   */
  const [zoom, setZoom] = useState(1);

  const hasPreview = Boolean(pdfPreviewUrl) || Boolean(imageUrl);

  // ============================================================
  // OPEN PREVIEW
  // ============================================================

  const openPreview = () => {
    if (!hasPreview) return;

    setZoom(1);
    setIsOpen(true);
  };

  // ============================================================
  // CLOSE PREVIEW
  // ============================================================

  const closePreview = () => {
    setIsOpen(false);
    setZoom(1);
  };

  // ============================================================
  // ESCAPE KEY
  // ============================================================

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // ============================================================
  // PREVENT BODY SCROLL WHILE VIEWER IS OPEN
  // ============================================================

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <>
      {/* ========================================================
          RESOURCE CARD
      ======================================================== */}

      <article
        onClick={openPreview}
        className={`
          group relative overflow-hidden
          rounded-md
          border border-slate-200/80
          bg-white
          shadow-[0_8px_28px_rgba(15,23,42,0.08)]
          ring-1 ring-slate-900/2
          transition-all duration-300

          ${
            hasPreview
              ? "cursor-pointer hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.15)]"
              : ""
          }
        `}
        role={hasPreview ? "button" : undefined}
        tabIndex={hasPreview ? 0 : undefined}
        onKeyDown={(event) => {
          if (!hasPreview) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPreview();
          }
        }}
      >
        {/* ======================================================
            PREVIEW AREA
        ====================================================== */}

        <div
          className="
            relative
            aspect-3/4
            overflow-hidden
            bg-slate-100
          "
        >
          {/* ====================================================
              PDF PREVIEW
          ==================================================== */}

          {isPdf && pdfPreviewUrl ? (
            <div
              className="
                absolute
                inset-2
                overflow-hidden
                rounded-md
                border
                border-slate-200/80
                bg-white
                shadow-[0_5px_20px_rgba(15,23,42,0.13)]
                ring-1
                ring-black/3
                transition-all
                duration-300
                group-hover:shadow-[0_12px_32px_rgba(15,23,42,0.18)]
              "
            >
              <PdfPreview
                src={pdfPreviewUrl}
                className="
                  h-full
                  w-full
                "
                showAllPages={false}
              />
            </div>
          ) : imageUrl ? (
            /* ==================================================
               IMAGE PREVIEW
            ================================================== */

            <Image
              src={imageUrl}
              alt={title}
              className="
                absolute
                inset-0
                z-0
                h-full
                w-full
                object-cover
                transition-transform
                duration-500
                group-hover:scale-[1.025]
              "
              loading="lazy"
            />
          ) : (
            /* ==================================================
               NO PREVIEW
            ================================================== */

            <div
              className={`
                absolute
                inset-0
                flex
                items-center
                justify-center
                ${softClass}
              `}
            >
              <div className="px-5 text-center">
                <div
                  className="
                    mx-auto
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-xl
                    bg-white
                    shadow-sm
                  "
                >
                  <FileText
                    className="
                      h-7
                      w-7
                      text-slate-500
                    "
                  />
                </div>

                <p
                  className="
                    mt-3
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.14em]
                    text-slate-500
                  "
                >
                  Preview unavailable
                </p>
              </div>
            </div>
          )}

          {/* ======================================================
              RESOURCE TYPE
          ====================================================== */}

          <div
            className="
              pointer-events-none
              absolute
              right-3
              top-3
              z-30
            "
          >
            <span
              className="
                rounded-md
                border
           
                bg-blue-400
                px-2.5
                py-1
                text-[9px]
                font-black
                uppercase
                tracking-[0.12em]
                text-white
                shadow-sm
                backdrop-blur-md
              "
            >
              {type}
            </span>
          </div>

          {/* ======================================================
              CENTER HOVER ICON
          ====================================================== */}

          {hasPreview && (
            <div
              className="
                pointer-events-none
                absolute
                left-1/2
                top-1/2
                z-30
                -translate-x-1/2
                -translate-y-1/2
                scale-90
                opacity-0
                transition-all
                duration-300
                group-hover:scale-100
                group-hover:opacity-100
              "
            ></div>
          )}

          {/* ======================================================
              BOTTOM GRADIENT
          ====================================================== */}

          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              z-10
              h-32
              bg-linear-to-t
              from-black/60
              via-black/15
              to-transparent
              transition-opacity
              duration-300
              group-hover:opacity-0
            "
          />

          {/* ======================================================
              NORMAL TITLE
          ====================================================== */}

          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              z-20
              px-4
              pb-5
              transition-all
              duration-300
              group-hover:translate-y-2
              group-hover:opacity-0
            "
          >
            <h3
              className="
                line-clamp-2
                text-sm
                font-black
                leading-5
                text-white
                drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]
              "
            >
              {title}
            </h3>
          </div>

          {/* ======================================================
              HOVER DESCRIPTION
          ====================================================== */}

          <div
            className="
              absolute
              inset-x-2
              bottom-2
              z-40

              translate-y-[calc(100%+16px)]
              opacity-0

              rounded-xl
              border
              border-white/50

              bg-white/75
              p-4

              shadow-[0_12px_38px_rgba(15,23,42,0.20)]

              backdrop-blur-xl
              backdrop-saturate-150

              transition-all
              duration-300
              ease-out

              group-hover:translate-y-0
              group-hover:opacity-100
            "
          >
            <h3
              className="
                line-clamp-2
                text-sm
                font-black
                leading-5
                text-slate-950
              "
            >
              {title}
            </h3>

            {description && (
              <p
                className="
                  mt-2
                  line-clamp-5
                  text-[11px]
                  font-medium
                  leading-5
                  text-slate-600
                "
              >
                {description}
              </p>
            )}
          </div>
        </div>
      </article>

      {/* ==========================================================
          LARGE PDF VIEWER
      ========================================================== */}

      {isOpen && (
        <div
          className="
      fixed
      inset-0
      z-100
      flex
      items-center
      justify-center
      bg-slate-950/90
      backdrop-blur-[2px]
    "
          role="dialog"
          aria-modal="true"
          aria-label={`${title} preview`}
          onClick={() => setIsOpen(false)}
        >
          {/* ========================================================
        CLOSE BUTTON
    ======================================================== */}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
            }}
            aria-label="Close preview"
            className="
        absolute
        right-5
        top-5
        z-120
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-full
        border
        border-white/15
        bg-black/45
        text-white
        shadow-[0_10px_35px_rgba(0,0,0,0.35)]
        backdrop-blur-xl
        transition-all
        hover:scale-105
        hover:bg-black/65
        active:scale-95
      "
          >
            <X className="h-5 w-5" />
          </button>

          {/* ========================================================
        PDF AREA
    ======================================================== */}

          <div
            className="
        relative
        h-full
        w-full
        overflow-hidden
      "
            onClick={(event) => event.stopPropagation()}
          >
            {isPdf && pdfPreviewUrl ? (
              <PdfPreview
                src={pdfPreviewUrl}
                className="h-full w-full"
                showAllPages={true}
                zoom={zoom}
              />
            ) : imageUrl ? (
              <div
                className="
            flex
            h-full
            w-full
            items-center
            justify-center
            overflow-auto
            p-6
          "
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={title}
                  className="
              max-h-full
              max-w-full
              object-contain
            "
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <FileText className="h-12 w-12 text-white/40" />
              </div>
            )}

            {/* ======================================================
          FLOATING CONTROL BAR
      ====================================================== */}

            <div
              className="
          absolute
          bottom-6
          left-1/2
          z-[110]
          flex
          -translate-x-1/2
          items-center
          gap-1
          rounded-2xl
          border
          border-white/15
          bg-slate-950/70
          p-1.5
          shadow-[0_15px_50px_rgba(0,0,0,0.45)]
          backdrop-blur-xl
        "
              onClick={(event) => event.stopPropagation()}
            >
              {/* ====================================================
            DOWNLOAD
        ==================================================== */}

              <a
                href={pdfPreviewUrl || imageUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                download
                aria-label="Download"
                className="
            flex
            h-10
            min-w-10
            items-center
            justify-center
            rounded-xl
            px-3
            text-white/90
            transition-all
            hover:bg-white/10
            hover:text-white
          "
              >
                <Download className="h-[18px] w-[18px]" />

                <span className="ml-2 hidden text-xs font-semibold sm:block">
                  Download
                </span>
              </a>

              <div className="mx-1 h-6 w-px bg-white/10" />

              {/* ====================================================
            ZOOM OUT
        ==================================================== */}

              <button
                type="button"
                onClick={() =>
                  setZoom((current) =>
                    Math.max(0.5, Number((current - 0.25).toFixed(2))),
                  )
                }
                disabled={zoom <= 0.5}
                aria-label="Zoom out"
                className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            text-white/90
            transition-all
            hover:bg-white/10
            hover:text-white
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
              >
                <ZoomOut className="h-[18px] w-[18px]" />
              </button>

              {/* ====================================================
            ZOOM LEVEL
        ==================================================== */}

              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom"
                className="
            flex
            h-10
            min-w-[58px]
            items-center
            justify-center
            rounded-xl
            px-2
            text-xs
            font-bold
            tabular-nums
            text-white
            transition-all
            hover:bg-white/10
          "
              >
                {Math.round(zoom * 100)}%
              </button>

              {/* ====================================================
            ZOOM IN
        ==================================================== */}

              <button
                type="button"
                onClick={() =>
                  setZoom((current) =>
                    Math.min(3, Number((current + 0.25).toFixed(2))),
                  )
                }
                disabled={zoom >= 3}
                aria-label="Zoom in"
                className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            text-white/90
            transition-all
            hover:bg-white/10
            hover:text-white
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
              >
                <ZoomIn className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

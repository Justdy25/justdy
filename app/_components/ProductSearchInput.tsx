"use client";

import { ArrowRight, Loader2, Package, Search, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface ProductSearchResult {
  id: string;
  title: string;
  slug: string;
  type: string;
  imageKey?: string | null;
  price?: number | null;
}

function formatImageUrl(key?: string | null) {
  if (!key) return null;

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  return `https://utfs.io/f/${key.replace(/^\/+/, "")}`;
}

export function ProductSearchInput() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(() => searchParams.get("search") || "");
  const [suggestions, setSuggestions] = useState<ProductSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    async function loadSuggestions() {
      setIsLoadingSuggestions(true);

      try {
        const response = await fetch(
          `/api/products/explore?search=${encodeURIComponent(query.trim())}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load product suggestions.");
        }

        const data = (await response.json()) as ProductSearchResult[];

        if (!controller.signal.aborted) {
          setSuggestions(data.slice(0, 6));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load search suggestions:", error);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      }
    }

    const timeout = setTimeout(loadSuggestions, query.trim() ? 250 : 0);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, isOpen]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  function handleSearch(term: string) {
    const trimmedTerm = term.trim();
    const params = new URLSearchParams(searchParams.toString());

    if (trimmedTerm) {
      params.set("search", trimmedTerm);
    } else {
      params.delete("search");
    }

    setIsOpen(false);

    startTransition(() => {
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      );
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSearch(query);
  }

  function clearSearch() {
    setQuery("");
    setSuggestions([]);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");

    setIsOpen(false);

    startTransition(() => {
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      );
    });

    inputRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search resources"
          aria-label="Search resources"
          className="h-11 w-full rounded-full border bg-background pl-11 pr-20 text-sm outline-none transition focus:border-[#857938] focus:ring-2 focus:ring-[#857938]/20"
        />

        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-12 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          aria-label="Search"
          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#857938] text-white transition hover:bg-[#70662e] disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </button>
      </form>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border bg-popover shadow-2xl">
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </div>
          ) : suggestions.length > 0 ? (
            <div className="p-2">
              {suggestions.map((product) => {
                const imageUrl = formatImageUrl(product.imageKey);

                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-muted"
                  >
                    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Package className="size-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {product.title}
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {product.type}
                      </p>
                    </div>

                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No matching resources.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

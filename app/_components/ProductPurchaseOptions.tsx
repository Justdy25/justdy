"use client";

import { Check, Download, Printer, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";

interface ProductPurchaseOptionsProps {
  productId: string;
  title: string;
  digitalPrice: number;
  printedPrice?: number | null;
  image?: string;
}

type PurchaseType = "digital" | "printed";

interface CartItem {
  id: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  purchaseType: PurchaseType;
}

export function ProductPurchaseOptions({
  productId,
  title,
  digitalPrice,
  printedPrice,
  image,
}: ProductPurchaseOptionsProps) {
  const hasPrintedOption =
    typeof printedPrice === "number" &&
    Number.isFinite(printedPrice) &&
    printedPrice > 0;

  const [selectedOption, setSelectedOption] = useState<PurchaseType>("digital");
  const [added, setAdded] = useState(false);

  const selectedOptionSafe = hasPrintedOption ? selectedOption : "digital";

  const isPrinted = selectedOptionSafe === "printed";
  const selectedPrice = isPrinted ? printedPrice! : digitalPrice;

  function addToCart() {
    const existingRaw = localStorage.getItem("cart");
    let existing: CartItem[] = [];

    try {
      const parsed = existingRaw ? JSON.parse(existingRaw) : [];
      if (Array.isArray(parsed)) {
        existing = parsed;
      }
    } catch {
      existing = [];
    }

    const cartItem: CartItem = {
      id: productId,
      title: isPrinted
        ? `${title} — Printed Hard Copy`
        : `${title} — Digital Download`,
      price: selectedPrice,
      image,
      quantity: 1,
      purchaseType: selectedOptionSafe,
    };

    const existingIndex = existing.findIndex(
      (item) =>
        item.id === productId && item.purchaseType === selectedOptionSafe,
    );

    if (existingIndex >= 0) {
      existing[existingIndex] = {
        ...existing[existingIndex],
        quantity: (existing[existingIndex].quantity || 1) + 1,
      };
    } else {
      existing.push(cartItem);
    }

    localStorage.setItem("cart", JSON.stringify(existing));
    window.dispatchEvent(new Event("cartUpdated"));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-xl shadow-black/5">
        <div className="border-b bg-muted/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#857938]">
            Get this resource
          </p>

          <h2 className="mt-2 text-xl font-bold">
            {hasPrintedOption ? "Choose your format" : "Digital access"}
          </h2>

          <div className="mt-5 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-[#857938]">
              {formatPrice(selectedPrice)}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {isPrinted ? "Printed hard copy" : "Digital download"}
          </p>
        </div>

        <div className="space-y-5 p-6">
          {hasPrintedOption ? (
            <div className="space-y-3">
              <PurchaseOption
                selected={selectedOptionSafe === "digital"}
                icon={<Download className="size-5" />}
                title="Digital Download"
                description="Instant access after purchase"
                price={digitalPrice}
                onClick={() => setSelectedOption("digital")}
              />

              <PurchaseOption
                selected={selectedOptionSafe === "printed"}
                icon={<Printer className="size-5" />}
                title="Printed Hard Copy"
                description="Physical copy shipped to you"
                price={printedPrice!}
                onClick={() => setSelectedOption("printed")}
              />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-[#857938] bg-[#857938]/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Download className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Digital Download</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Instant access after purchase
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Your selection
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {isPrinted ? "Printed Hard Copy" : "Digital Download"}
                </p>
              </div>
              <p className="text-xl font-bold text-[#857938]">
                {formatPrice(selectedPrice)}
              </p>
            </div>

            {isPrinted ? (
              <div className="mt-3 flex items-start gap-2 border-t pt-3">
                <Truck className="mt-0.5 size-4 shrink-0 text-[#857938]" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Shipping details are collected during checkout.
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <Benefit
              icon={<Check className="size-4" />}
              title="Secure purchase"
              description="Protected payment and checkout"
            />
            <Benefit
              icon={<Check className="size-4" />}
              title={isPrinted ? "Physical delivery" : "Instant access"}
              description={
                isPrinted
                  ? "Shipped to your checkout address"
                  : "Access your digital files after purchase"
              }
            />
          </div>

          <button
            type="button"
            onClick={addToCart}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#857938] px-4 text-sm font-semibold text-white transition hover:bg-[#70662e]"
          >
            {added
              ? "Added to Cart"
              : isPrinted
                ? "Add Printed Copy to Cart"
                : "Add Digital Download to Cart"}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Secure checkout</span>
            <span>•</span>
            <span>Protected payment</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PurchaseOption({
  selected,
  icon,
  title,
  description,
  price,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  price: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
        selected
          ? "border-[#857938] bg-[#857938]/5"
          : "border-border bg-background hover:border-[#857938]/50"
      }`}
    >
      <div
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected
            ? "border-[#857938] bg-[#857938]"
            : "border-muted-foreground/30"
        }`}
      >
        {selected ? <Check className="size-3 text-white" /> : null}
      </div>

      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <p className="shrink-0 text-sm font-bold text-[#857938]">
        {formatPrice(price)}
      </p>
    </button>
  );
}

function Benefit({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function formatPrice(priceInCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceInCents / 100);
}

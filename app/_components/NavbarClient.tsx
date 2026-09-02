"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  ShoppingBag,
  Trash2,
  ArrowRight,
  ShoppingCartIcon,
  Loader2,
  ShoppingBasket,
  MessageSquare,
  Settings,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

import { AuthModal } from "../(auth)/AuthModal";
import { Separator } from "./ui/separator";
import Image from "next/image";

import { ProductSearchInput } from "./ProductSearchInput";
import { ProductMobileMenu } from "./ProductMegaMenu";

import { createCheckoutSessionAction } from "../actions/manage-checkout-session";
import { toast } from "sonner";
import MyLogo from "./Logo";

// ============================================================
// TYPES
// ============================================================

const serviceItems = [
  {
    title: "Tutoring",
    href: "/free-assessment",
  },
  {
    title: "About Me",
    href: "/about",
  },
];

interface CartItem {
  id: string;
  title: string;
  price: number;
  image?: string;
  quantity?: number;
}

interface AccountMenuItemProps {
  href?: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}

// ============================================================
// ACCOUNT MENU ITEM
// ============================================================

function AccountMenuItem({
  href,
  icon,
  title,
  subtitle,
  onClick,
}: AccountMenuItemProps) {
  const content = (
    <div
      className="
        group
        flex
        items-center
        gap-3
        rounded-md
        px-3
        py-2.5
        transition-all
        duration-200
        hover:bg-slate-50
      "
    >
      <div
        className="
          flex
          size-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-slate-100
          text-slate-700
          transition-colors
          group-hover:bg-[#857938]/10
          group-hover:text-[#857938]
        "
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{title}</p>

        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>
        )}
      </div>

      <ChevronRight
        className="
          size-4
          text-slate-300
          opacity-0
          transition-all
          group-hover:translate-x-0.5
          group-hover:opacity-100
        "
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

// ============================================================
// COMPONENT
// ============================================================

export function NavbarClient() {
  const { data: session, isPending } = authClient.useSession();

  // ============================================================
  // URL SEARCH PARAMS
  // ============================================================

  const searchParams = useSearchParams();

  // ============================================================
  // STATE
  // ============================================================

  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Account dropdown
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ============================================================
  // LOAD CART
  // ============================================================

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);

      const savedCart = localStorage.getItem("cart");

      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);

          if (Array.isArray(parsed)) {
            setCartItems(parsed);
          }
        } catch (error) {
          console.error("Failed to parse cart:", error);
        }
      }
    });

    const handleStorageChange = () => {
      const savedCart = localStorage.getItem("cart");

      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);

          if (Array.isArray(parsed)) {
            setCartItems(parsed);
          }
        } catch (error) {
          console.error("Failed to parse cart:", error);
        }
      } else {
        setCartItems([]);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("cartUpdated", handleStorageChange);

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cartUpdated", handleStorageChange);
    };
  }, []);

  // ============================================================
  // OPEN LOGIN MODAL FROM URL
  // ============================================================

  useEffect(() => {
    if (!mounted || isPending || session) {
      return;
    }

    const shouldOpenLogin = searchParams.get("login") === "true";

    if (!shouldOpenLogin) {
      return;
    }

    const timer = window.setTimeout(() => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;

      const triggerType = isMobile ? "mobile" : "desktop";

      const loginTrigger = document.querySelector(
        `[data-login-trigger="${triggerType}"]`,
      ) as HTMLButtonElement | null;

      if (!loginTrigger) {
        console.warn(`SigninModal ${triggerType} trigger was not found.`);
        return;
      }

      loginTrigger.click();

      const url = new URL(window.location.href);

      url.searchParams.delete("login");

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mounted, isPending, session, searchParams]);

  // ============================================================
  // CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
  // ============================================================

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountOpen]);

  // ============================================================
  // CART
  // ============================================================

  const updateCartStorage = (updatedItems: CartItem[]) => {
    setCartItems(updatedItems);

    localStorage.setItem("cart", JSON.stringify(updatedItems));

    window.dispatchEvent(new Event("cartUpdated"));
  };

  const removeItem = (id: string) => {
    const updated = cartItems.filter((item) => item.id !== id);

    updateCartStorage(updated);
  };

  const updateQuantity = (id: string, delta: number) => {
    const updated = cartItems.map((item) => {
      if (item.id === id) {
        const currentQty = item.quantity || 1;

        const newQty = Math.max(1, currentQty + delta);

        return {
          ...item,
          quantity: newQty,
        };
      }

      return item;
    });

    updateCartStorage(updated);
  };

  // ============================================================
  // CHECKOUT
  // ============================================================

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    setIsCheckoutLoading(true);
    setIsLoading(true);

    try {
      const checkoutItems = cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity || 1,
      }));

      const res = await createCheckoutSessionAction(checkoutItems);

      if (res.status === "error") {
        toast.error(res.message || "Checkout failed.");
        return;
      }

      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to proceed to checkout.",
      );
    } finally {
      setIsCheckoutLoading(false);
      setIsLoading(false);
    }
  };

  // ============================================================
  // CART TOTALS
  // ============================================================

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * (item.quantity || 1),
    0,
  );

  const totalCount = cartItems.reduce(
    (acc, item) => acc + (item.quantity || 1),
    0,
  );

  // ============================================================
  // USER ROLE
  // ============================================================

  const rolesList: string[] = [];

  if (session?.user) {
    const userObj = session.user as {
      role?: string;
      roles?: string[];
    };

    if (userObj.role) {
      rolesList.push(userObj.role);
    }

    if (Array.isArray(userObj.roles)) {
      rolesList.push(...userObj.roles);
    }
  }

  const normalizedRoles = rolesList.map((role) => role.toLowerCase());

  const dashboardUrl =
    normalizedRoles.includes("admin") || normalizedRoles.includes("educator")
      ? "/manage"
      : "/learner";

  const userRole = session?.user?.role?.toLowerCase() ?? "learner";

  // ============================================================
  // USER INFORMATION
  // ============================================================

  const userName = session?.user?.name?.trim() || "User";

  const userEmail = session?.user?.email ?? "";

  const userImage = session?.user?.image ?? "";

  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  // ============================================================
  // SIGN OUT
  // ============================================================

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setAccountOpen(false);

    try {
      await authClient.signOut();

      toast.success("You have been signed out.");

      window.location.href = "/";
    } catch (error) {
      console.error("Sign out error:", error);

      toast.error("Unable to sign out. Please try again.");

      setIsSigningOut(false);
    }
  };

  // ============================================================
  // ANIMATIONS
  // ============================================================

  const menuVariants: Variants = {
    hidden: {
      opacity: 0,
      y: -15,
      transition: {
        duration: 0.2,
        ease: "easeInOut",
      },
    },

    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  };

  const accountMenuVariants: Variants = {
    hidden: {
      opacity: 0,
      y: -8,
      scale: 0.98,
      transformOrigin: "top right",
    },

    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transformOrigin: "top right",
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
  };

  const cartDrawerVariants: Variants = {
    hidden: {
      x: "100%",
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },

    visible: {
      x: "0%",
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const query = formData.get("search")?.toString().trim();

    if (!query) {
      return;
    }

    window.location.href = `/products?search=${encodeURIComponent(query)}`;
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };
  const openAuthModal = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
    setMobileOpen(false);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <header
      className="
        sticky
        top-0
        z-50
        w-full
        border-b
        border-slate-200/80
        bg-white/90
        backdrop-blur-xl
        shadow-[0_1px_12px_rgba(15,23,42,0.04)]
      "
    >
      <div
        className="
          mx-auto
          flex
          h-18
          max-w-7xl
          items-center
          px-4
          sm:px-6
          lg:px-8
          xl:px-10
        "
      >
        {/* ======================================================
            DESKTOP HEADER
        ====================================================== */}

        <div className="hidden w-full items-center gap-3 md:flex">
          {/* LOGO */}
          <div className="shrink-0">
            <MyLogo showText={true} />
          </div>

          {/* PRIMARY NAV */}
          <nav
            className="ml-3 flex shrink-0 items-center gap-1.5"
            aria-label="Primary navigation"
          >
            {/* TUTORING — PRIMARY CTA */}
            <Link
              href="/free-assessment"
              className="
                group
                inline-flex
                h-10
                items-center
                gap-2
                whitespace-nowrap
                rounded-md
                border
                border-blue-200
                bg-blue-50
                px-3.5
                text-sm
                font-semibold
                text-blue-700
                shadow-sm
                transition-all
                duration-200
                hover:border-blue-300
                hover:bg-blue-100
                hover:text-blue-800
                hover:shadow-md
                active:scale-[0.98]
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500/20
              "
            >
              <span className="flex size-6 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                <GraduationCap className="size-3.5" />
              </span>
              Free Session
              <span className="hidden rounded-full bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 xl:inline-flex">
                1:1
              </span>
            </Link>

            {/* VIDEO LESSONS */}
            <Link
              href="/videos"
              className="
                inline-flex
                h-10
                items-center
                whitespace-nowrap
                rounded-xl
                px-3
                text-sm
                font-medium
                text-slate-600
                transition-all
                duration-200
                hover:bg-slate-100
                hover:text-slate-900
                focus:outline-none
                focus:ring-2
                focus:ring-slate-500/10
              "
            >
              Video Lessons
            </Link>
          </nav>

          {/* SEARCH */}
          <div className="ml-2 min-w-0 flex-1">
            <div className="mx-auto max-w-2xl">
              <ProductSearchInput />
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            {!isPending &&
              mounted &&
              (session ? (
                /* LOGGED-IN ACCOUNT */

                <div ref={accountRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((previous) => !previous)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    aria-label="Open account menu"
                    className={cn(
                      `
                        flex
                        h-10
                        items-center
                        gap-2
                        rounded-xl
                        px-2.5
                        pr-3
                        text-sm
                        font-medium
                        transition-all
                        duration-200
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500/20
                      `,
                      accountOpen
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <div
                      className="
                        relative
                        flex
                        size-8
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-full
                        bg-blue-600
                        text-xs
                        font-bold
                        text-white
                        ring-2
                        ring-white
                      "
                    >
                      {userImage ? (
                        <Image
                          src={userImage}
                          alt={userName}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      ) : (
                        userInitials
                      )}
                    </div>

                    <span className="hidden max-w-[100px] truncate text-sm font-semibold text-slate-700 lg:block">
                      {userName}
                    </span>

                    <ChevronDown
                      className={cn(
                        "size-4 text-slate-400 transition-transform",
                        accountOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {/* ACCOUNT DROPDOWN */}

                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        variants={accountMenuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="
                          absolute
                          right-0
                          top-[calc(100%+10px)]
                          z-100
                          w-80
                          overflow-hidden
                          rounded-2xl
                          border
                          border-slate-200/80
                          bg-white
                          shadow-[0_24px_70px_rgba(15,23,42,0.14)]
                          ring-1 ring-black/2
                        "
                      >
                        {/* PROFILE HEADER */}

                        <div
                          className="
                            border-b
                            border-slate-100
                            bg-gradient-to-br
                            from-blue-50
                            via-white
                            to-slate-50
                            p-4
                          "
                        >
                          <Link
                            href={dashboardUrl}
                            onClick={() => setAccountOpen(false)}
                            className="
                              group
                              flex
                              items-center
                              gap-3
                              rounded-xl
                              p-2
                              transition-colors
                              hover:bg-white/80
                            "
                          >
                            <div
                              className="
                                relative
                                flex
                                size-12
                                shrink-0
                                items-center
                                justify-center
                                overflow-hidden
                                rounded-full
                                bg-blue-600
                                text-sm
                                font-bold
                                text-white
                              "
                            >
                              {userImage ? (
                                <Image
                                  src={userImage}
                                  alt={userName}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                userInitials
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-bold text-slate-900">
                                {userName}
                              </p>

                              <p className="truncate text-sm text-slate-500">
                                Go to dashboard
                              </p>
                            </div>

                            <ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </div>

                        {/* ACCOUNT OPTIONS */}

                        <div className="p-2">
                          <AccountMenuItem
                            href="/settings"
                            icon={<Settings className="size-5" />}
                            title="Account Settings"
                            subtitle="Manage your account"
                            onClick={() => setAccountOpen(false)}
                          />

                          <button
                            type="button"
                            disabled={isSigningOut}
                            onClick={handleSignOut}
                            className="
                              group
                              flex
                              w-full
                              items-center
                              gap-3
                              rounded-xl
                              px-3
                              py-2.5
                              text-left
                              transition-colors
                              hover:bg-red-50
                            "
                          >
                            <div
                              className="
                                flex
                                size-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-red-50
                                text-red-500
                              "
                            >
                              {isSigningOut ? (
                                <Loader2 className="size-5 animate-spin" />
                              ) : (
                                <LogOut className="size-5" />
                              )}
                            </div>

                            <span className="text-sm font-medium text-red-600">
                              {isSigningOut ? "Signing out..." : "Sign out"}
                            </span>
                          </button>
                        </div>

                        {/* ACCOUNT FOOTER */}

                        <div
                          className="
                            border-t
                            border-slate-100
                            bg-slate-50
                            px-5
                            py-3
                          "
                        >
                          <p className="truncate text-[11px] text-slate-400">
                            {userEmail}
                          </p>

                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            {userRole}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  {/* BECOME A MEMBER */}

                  <button
                    type="button"
                    onClick={() => openAuthModal("signup")}
                    className="
                      hidden
                      h-10
                      shrink-0
                      items-center
                      whitespace-nowrap
                      rounded-lg
                      px-3
                      text-sm
                      font-semibold
                      text-blue-600
                      transition-all
                      duration-200
                      hover:bg-blue-50
                      hover:text-blue-700
                      lg:flex
                    "
                  >
                    Become a Member
                  </button>

                  {/* LOGIN */}

                  <button
                    type="button"
                    data-login-trigger="desktop"
                    onClick={() => openAuthModal("signin")}
                    className="
                      flex
                      h-10
                      shrink-0
                      items-center
                      whitespace-nowrap
                      rounded-lg
                      px-3
                      text-sm
                      font-medium
                      text-slate-600
                      transition-all
                      duration-200
                      hover:bg-slate-50
                      hover:text-slate-900
                    "
                  >
                    Login
                  </button>
                </>
              ))}

            {/* CART */}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="
                relative
                flex
                size-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                text-slate-600
                transition-all
                duration-200
                hover:bg-blue-50
                hover:text-blue-600
                active:scale-95
              "
              aria-label="Shopping Cart"
            >
              <ShoppingCartIcon className="size-5" />

              {mounted && totalCount > 0 && (
                <span
                  className="
                    absolute
                    -right-1
                    -top-1
                    flex
                    h-5
                    min-w-5
                    items-center
                    justify-center
                    rounded-full
                    bg-blue-600
                    px-1
                    text-[10px]
                    font-bold
                    text-white
                    shadow-sm
                  "
                >
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <AuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          defaultMode={authMode}
        />

        {/* ======================================================
            MOBILE HEADER
        ====================================================== */}

        <div className="flex w-full min-w-0 items-center gap-2 md:hidden">
          {/* ====================================================
              MOBILE LOGO
          ==================================================== */}

          <div className="shrink-0">
            <MyLogo showText={false} />
          </div>

          {/* ====================================================
              MOBILE SEARCH

              The search takes all remaining available width.
          ==================================================== */}

          <div className="min-w-0 flex-1">
            <ProductSearchInput />
          </div>

          {/* ====================================================
              MOBILE ACTIONS
          ==================================================== */}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* MOBILE ACCOUNT */}

            {session && (
              <button
                type="button"
                onClick={() => setAccountOpen((previous) => !previous)}
                className="
                  relative
                  flex
                  size-9
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-full
                  bg-[#857938]
                  text-xs
                  font-bold
                  text-white
                  ring-2
                  ring-white
                  shadow-sm
                "
                aria-label="Account"
              >
                {userImage ? (
                  <Image
                    src={userImage}
                    alt={userName}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  userInitials
                )}
              </button>
            )}

            {/* MOBILE CART */}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="
                relative
                cursor-pointer
                rounded-lg
                p-2
                text-slate-700
                transition-colors
                hover:bg-slate-100
                hover:text-[#857938]
                dark:text-slate-300
              "
              aria-label="Shopping Cart"
            >
              <ShoppingCartIcon className="size-5" />

              {mounted && totalCount > 0 && (
                <span
                  className="
                    absolute
                    -right-1
                    -top-1
                    flex
                    h-4
                    min-w-4
                    items-center
                    justify-center
                    rounded-full
                    bg-[#857938]
                    px-1
                    text-[10px]
                    font-bold
                    text-white
                  "
                >
                  {totalCount}
                </span>
              )}
            </button>

            {/* MOBILE MENU */}

            <button
              type="button"
              onClick={() => setMobileOpen((previous) => !previous)}
              className="
                cursor-pointer
                rounded-lg
                p-2
                text-slate-600
                transition-colors
                hover:text-[#857938]
              "
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          MOBILE ACCOUNT DROPDOWN
      ======================================================== */}

      <AnimatePresence>
        {accountOpen && session && mounted && (
          <motion.div
            variants={accountMenuVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="
              fixed
              left-3
              right-3
              top-21
              z-100
              max-h-[calc(100vh-6rem)]
              overflow-y-auto
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-2xl
              md:hidden
            "
          >
            {/* PROFILE */}

            <div className="border-b border-slate-100 bg-linear-to-br from-[#857938]/10 via-white to-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="
                    relative
                    flex
                    size-12
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-full
                    bg-[#857938]
                    text-sm
                    font-bold
                    text-white
                  "
                >
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt={userName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    userInitials
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">
                    {userName}
                  </p>

                  <p className="truncate text-sm text-slate-500">{userEmail}</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <AccountMenuItem
                href={dashboardUrl}
                icon={<LayoutDashboard className="size-5" />}
                title="Dashboard"
                onClick={() => setAccountOpen(false)}
              />

              <AccountMenuItem
                href="/purchases"
                icon={<ShoppingBasket className="size-5" />}
                title="Purchases & Downloads"
                onClick={() => setAccountOpen(false)}
              />

              <AccountMenuItem
                href="/messages"
                icon={<MessageSquare className="size-5" />}
                title="Messages"
                onClick={() => setAccountOpen(false)}
              />

              <AccountMenuItem
                href="/settings"
                icon={<Settings className="size-5" />}
                title="Account Settings"
                onClick={() => setAccountOpen(false)}
              />

              <button
                type="button"
                disabled={isSigningOut}
                onClick={handleSignOut}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3
                  py-3
                  text-left
                  text-red-600
                  hover:bg-red-50
                "
              >
                {isSigningOut ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <LogOut className="size-5" />
                )}

                <span className="text-sm font-medium">
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          CART DRAWER
      ======================================================== */}

      <AnimatePresence>
        {cartOpen && (
          <div className="fixed inset-0 z-200 flex justify-end">
            {/* BACKDROP */}

            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 0.5,
              }}
              exit={{
                opacity: 0,
              }}
              onClick={() => setCartOpen(false)}
              className="
                absolute
                inset-0
                bg-black/60
                backdrop-blur-xs
              "
            />

            {/* DRAWER */}

            <motion.div
              variants={cartDrawerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="
                relative
                z-10
                flex
                h-screen
                w-full
                max-w-md
                flex-col
                border-l
                border-slate-200
                bg-background
                shadow-2xl
              "
            >
              {/* DRAWER HEADER */}

              <div
                className="
                  flex
                  shrink-0
                  items-center
                  justify-between
                  border-b
                  border-slate-200
                  p-4
                  sm:p-6
                "
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="size-5 text-[#857938]" />

                  <h2 className="text-lg font-semibold">Your Cart</h2>

                  <span
                    className="
                      rounded-full
                      bg-muted
                      px-2
                      py-0.5
                      text-xs
                      font-medium
                    "
                  >
                    {totalCount}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="
                    cursor-pointer
                    rounded-md
                    p-1
                    text-slate-500
                    transition-colors
                    hover:bg-muted
                    hover:text-foreground
                  "
                  aria-label="Close cart"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* CART ITEMS */}

              <div
                className="
                  flex-1
                  space-y-4
                  overflow-y-auto
                  bg-emerald-900/30
                  p-4
                  sm:p-6
                "
              >
                {cartItems.length === 0 ? (
                  <div
                    className="
                      flex
                      h-full
                      flex-col
                      items-center
                      justify-center
                      space-y-3
                      py-12
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
                        text-muted-foreground
                      "
                    >
                      <ShoppingBag className="size-6" />
                    </div>

                    <p className="text-base font-medium">Your cart is empty</p>

                    <p className="max-w-xs text-xs text-muted-foreground">
                      Explore our products and add items to your cart to get
                      started.
                    </p>

                    <Button
                      onClick={() => setCartOpen(false)}
                      asChild
                      className="
                        mt-2
                        cursor-pointer
                        bg-[#857938]
                        text-white
                        hover:bg-[#857000]
                      "
                    >
                      <Link href="/products">Browse Products</Link>
                    </Button>
                  </div>
                ) : (
                  cartItems.map((item) => {
                    const qty = item.quantity || 1;

                    return (
                      <div
                        key={item.id}
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          rounded-lg
                          border
                          border-slate-200
                          bg-card
                          p-3
                        "
                      >
                        {/* IMAGE */}

                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.title}
                            width={64}
                            height={64}
                            className="
                              size-16
                              shrink-0
                              rounded-md
                              border
                              object-cover
                            "
                          />
                        ) : (
                          <div
                            className="
                              flex
                              size-16
                              shrink-0
                              items-center
                              justify-center
                              rounded-md
                              bg-muted
                              font-bold
                              text-muted-foreground
                            "
                          >
                            {item.title.charAt(0)}
                          </div>
                        )}

                        {/* DETAILS */}

                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-medium">
                            {item.title}
                          </h4>

                          <p className="mt-0.5 text-xs font-bold text-primary">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(item.price / 100)}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="
                                flex
                                size-5
                                cursor-pointer
                                items-center
                                justify-center
                                rounded
                                bg-muted
                                text-xs
                                hover:bg-slate-200
                              "
                            >
                              -
                            </button>

                            <span className="w-4 text-center text-xs font-medium">
                              {qty}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="
                                flex
                                size-5
                                cursor-pointer
                                items-center
                                justify-center
                                rounded
                                bg-muted
                                text-xs
                                hover:bg-slate-200
                              "
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* REMOVE */}

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="
                            cursor-pointer
                            p-1.5
                            text-muted-foreground
                            transition-colors
                            hover:text-red-500
                          "
                          aria-label={`Remove ${item.title} from cart`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* CART FOOTER */}

              {cartItems.length > 0 && (
                <div
                  className="
                    shrink-0
                    space-y-3
                    border-t
                    border-slate-200
                    bg-muted/20
                    p-4
                    sm:p-6
                  "
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>

                    <span className="text-base font-semibold">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(subtotal / 100)}
                    </span>
                  </div>

                  <Separator />

                  <Button
                    disabled={isCheckoutLoading}
                    className="
                      flex
                      w-full
                      cursor-pointer
                      items-center
                      justify-center
                      gap-2
                      bg-[#857938]
                      text-white
                      hover:bg-[#857000]
                    "
                    onClick={handleCheckout}
                  >
                    {isCheckoutLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Redirecting to Checkout...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Checkout</span>

                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          MOBILE NAVIGATION
      ======================================================== */}

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="
              overflow-hidden
              border-t
              border-slate-100
              bg-white/95
              px-4
              py-4
              backdrop-blur-md
              md:hidden
            "
          >
            {/* ====================================================
                PRODUCTS
            ==================================================== */}

            <div>
              <div
                className="
                  px-3
                  pb-2
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wider
                  text-slate-400
                "
              >
                Explore Products
              </div>

              <ProductMobileMenu onClose={closeMobileMenu} />
            </div>

            {/* ====================================================
                SERVICES
            ==================================================== */}

            <div
              className="
                mt-4
                flex
                flex-col
                space-y-1
                border-t
                border-slate-100
                pt-3
              "
            >
              <div
                className="
                  px-3
                  pb-2
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wider
                  text-slate-400
                "
              >
                Services
              </div>

              {serviceItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    item.title === "Tutoring"
                      ? "border border-blue-200 bg-blue-50 font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  onClick={closeMobileMenu}
                >
                  {item.title}
                </Link>
              ))}
            </div>

            {/* ====================================================
                MOBILE AUTH
            ==================================================== */}

            {/* ====================================================
    MOBILE AUTH
==================================================== */}

            {session ? (
              <div
                className="
      mt-3
      border-t
      border-slate-100
      pt-3
    "
              >
                <Link
                  href={dashboardUrl}
                  className="
        block
        rounded-lg
        bg-[#857938]
        px-3
        py-2.5
        text-center
        text-sm
        font-medium
        text-white
        transition-colors
        hover:bg-[#70662e]
      "
                  onClick={closeMobileMenu}
                >
                  Go to Dashboard →
                </Link>
              </div>
            ) : (
              <div
                className="
      mt-3
      flex
      flex-col
      gap-2
      border-t
      border-slate-100
      pt-3
    "
              >
                {/* MOBILE LOGIN */}
                <button
                  type="button"
                  onClick={() => openAuthModal("signin")}
                  className="
    block
    w-full
    cursor-pointer
    py-2
    text-center
    text-sm
    font-medium
    text-slate-700
    transition-colors
    hover:text-[#857938]
  "
                >
                  Log in
                </button>

                {/* MOBILE SIGN UP */}
                <button
                  type="button"
                  onClick={() => openAuthModal("signup")}
                  className="
    block
    w-full
    cursor-pointer
    rounded-lg
    bg-[#857938]
    py-2
    text-center
    text-sm
    font-medium
    text-white
    transition-colors
    hover:bg-[#70662e]
  "
                >
                  Get Started
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/zodSchemas";
import { User } from "@/lib/auth";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";
import { Input } from "@/app/_components/ui/input";
import { Button } from "@/app/_components/ui/button";

interface LoginModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSwitchToSignup?: () => void;
  onSuccess?: () => void;
}

export function SigninModal({
  children,
  open,
  onOpenChange,
  onSwitchToSignup,
  onSuccess,
}: LoginModalProps) {
  const searchParams = useSearchParams();
  const [isPending] = useTransition();
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const rawCallbackUrl = searchParams.get("callbackUrl");

  const callbackUrl =
    rawCallbackUrl &&
    rawCallbackUrl.startsWith("/") &&
    !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : null;

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = isControlled ? onOpenChange : setInternalOpen;

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function signInWithEmail(values: z.infer<typeof loginSchema>) {
    setLoading(true);

    try {
      const { data, error } = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
        rememberMe: true,
      });

      if (error) {
        toast.error(error.message || "Invalid credentials");
        return;
      }

      if (!data?.user) {
        toast.error("Login completed, but no user session was returned.");
        return;
      }

      /*
       * Verify that Better Auth actually created a readable session
       * before closing the modal or navigating away.
       *
       * This prevents the previous behavior where the modal closed
       * even though the browser did not have a usable session.
       */
      const { data: session, error: sessionError } =
        await authClient.getSession({
          query: {
            disableCookieCache: true,
          },
        });

      if (sessionError) {
        console.error("SESSION VERIFICATION ERROR:", sessionError);

        toast.error(
          sessionError.message ||
            "Login succeeded, but your session could not be verified.",
        );

        return;
      }

      if (!session?.user) {
        console.error(
          "SESSION VERIFICATION FAILED: Better Auth returned no session user.",
        );

        toast.error(
          "Login succeeded, but your session was not saved. Please try again.",
        );

        return;
      }

      const role =
        (session.user as User).role?.toLowerCase() ||
        (data.user as User).role?.toLowerCase() ||
        "student";

      Cookies.set("role", role, {
        expires: 7,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      /*
       * Notify other client components, especially NavbarClient,
       * that authentication state has changed.
       *
       * NavbarClient listens for this event and calls
       * authClient.useSession().refetch() so the authenticated
       * navigation UI updates immediately without requiring the
       * user to manually refresh the page.
       */
      window.dispatchEvent(new Event("justdy:auth-state-changed"));

      toast.success("Successfully logged in!");

      onSuccess?.();
      handleOpenChange?.(false);

      if (callbackUrl) {
        const url = new URL(window.location.href);

        url.searchParams.delete("callbackUrl");

        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );

        window.location.assign(callbackUrl);
        return;
      }

      /*
       * A full reload ensures server components read the newly
       * established Better Auth session cookie.
       */
      window.location.reload();
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      toast.error("Something went wrong during login");
    } finally {
      setLoading(false);
    }
  }

  const isSubmitting = loading || isPending;

  return (
    <>
      {children ? (
        <button
          type="button"
          onClick={() => handleOpenChange?.(true)}
          className="contents"
        >
          {children}
        </button>
      ) : null}

      {isOpen ? <div className="hidden" aria-hidden="true" /> : null}

      <div className="w-full overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[0_24px_80px_-24px_hsl(var(--foreground)/0.25)]">
        <div className="p-6 sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back
            </h2>

            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Log in to continue your learning journey.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(signInWithEmail)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-medium text-foreground">
                      Email <span className="text-destructive">*</span>
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="name@email.com"
                        {...field}
                        className="h-11 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-medium text-foreground">
                      Password <span className="text-destructive">*</span>
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        {...field}
                        className="h-11 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              {onSwitchToSignup ? (
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                >
                  Sign up instead
                </button>
              ) : null}
            </p>

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              This site is protected by reCAPTCHA Enterprise and the Google{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Terms of Service
              </a>{" "}
              apply.
            </p>
          </div>
        </div>

        <div className="border-t border-border bg-muted/50 px-4 py-2.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Protected by SSL Encryption
          </p>
        </div>
      </div>
    </>
  );
}

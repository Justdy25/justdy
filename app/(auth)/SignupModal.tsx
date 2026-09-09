"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader,
  UserPlus,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

import { signupSchema } from "@/lib/zodSchemas";
import { signupUser } from "@/app/actions/signup-user";

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

import LogoImg from "@/public/images/logo.png";

type RoleOption = "Learner" | "Educator";

interface SignupModalProps {
  onSwitchToSignin?: () => void;
  onSuccess?: () => void;
}

export function SignupModal({ onSwitchToSignin, onSuccess }: SignupModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<RoleOption>("Learner");
  const [password, setPassword] = useState("");

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof signupSchema>) {
    startTransition(async () => {
      const res = await signupUser({
        ...values,
        role: selectedRole,
      });

      if (res.type === "awaiting_admin_approval") {
        toast.info("Your account is awaiting admin approval.");
        onSuccess?.();
        return;
      }

      if (res.type === "exists_verified") {
        toast.error("Account already exists. Please log in.");
        onSwitchToSignin?.();
        return;
      }

      if (res.type === "exists_unverified") {
        toast.error("An unverified account already exists with this email.");
        onSuccess?.();
        router.push(
          `/verify-request?email=${encodeURIComponent(values.email)}`,
        );
        return;
      }

      if (res.type === "created") {
        toast.success("Verification email sent! Please check your inbox.");
        onSuccess?.();
        router.push(
          `/verify-request?email=${encodeURIComponent(values.email)}`,
        );
        return;
      }

      toast.error("Something went wrong. Please try again.");
    });
  }

  const getStrength = (pass: string) => {
    let score = 0;
    if (!pass) return score;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getStrength(password);
  const strengthClasses = [
    "bg-muted",
    "bg-destructive",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-500",
  ];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[0_24px_80px_-24px_hsl(var(--foreground)/0.25)]">
      <div className="p-6 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Image src={LogoImg} alt="Justdy" width={40} height={40} priority />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Choose how you want to use Justdy.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <FormLabel className="text-xs font-medium text-foreground">
                I am joining as a
              </FormLabel>

              <div className="grid grid-cols-2 gap-2.5">
                {(["Learner", "Educator"] as const).map((role) => {
                  const selected = selectedRole === role;
                  const isLearner = role === "Learner";

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      aria-pressed={selected}
                      className={`relative flex min-h-[104px] flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {selected && (
                        <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-primary" />
                      )}

                      <div
                        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
                          selected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isLearner ? (
                          <BookOpen className="h-4 w-4" />
                        ) : (
                          <GraduationCap className="h-4 w-4" />
                        )}
                      </div>

                      <span className="text-xs font-semibold text-foreground">
                        {role}
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        {isLearner
                          ? "Explore courses & sessions"
                          : "Teach & offer bookings"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Full Name"
                      autoComplete="name"
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Email Address"
                      autoComplete="email"
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
                <FormItem>
                  <FormControl>
                    <div className="space-y-1.5">
                      <Input
                        type="password"
                        placeholder="Password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          setPassword(event.target.value);
                        }}
                        className="h-11 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div
                        className="flex h-1 gap-1 px-0.5"
                        aria-label={`Password strength ${strength} of 4`}
                      >
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`h-full flex-1 rounded-full transition-colors ${
                              strength >= step
                                ? strengthClasses[strength]
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm Password"
                      autoComplete="new-password"
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
              disabled={isPending}
              className="mt-2 h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              {isPending ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Continue as{" "}
                  {selectedRole === "Educator" ? "Educator" : "Learner"}
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-6 border-t border-border pt-5 text-center">
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            {onSwitchToSignin ? (
              <button
                type="button"
                onClick={onSwitchToSignin}
                className="inline-flex items-center gap-1 font-semibold text-primary transition-colors hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Sign in
              </button>
            ) : null}
          </p>
        </div>
      </div>

      <div className="border-t border-border bg-muted/50 px-4 py-2.5 text-center">
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Protected by SSL Encryption
        </p>
      </div>
    </div>
  );
}

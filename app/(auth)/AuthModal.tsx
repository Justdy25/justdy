"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/app/_components/ui/dialog";

import { SigninModal } from "./SigninModal";
import { SignupModal } from "./SignupModal";

type AuthMode = "signin" | "signup";

interface AuthModalProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultMode?: AuthMode;
}

export function AuthModal({
  children,
  open,
  onOpenChange,
  defaultMode = "signin",
}: AuthModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      setMode(defaultMode);
    }
  };

  const handleSigninSuccess = () => {
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}

      <DialogContent
        className="
          w-[calc(100%-2rem)]
          max-w-[480px]
          max-h-[calc(100vh-2rem)]
          overflow-y-auto
          overflow-x-hidden
          rounded-xl
          border-0
          bg-transparent
          p-0
          shadow-2xl
          sm:max-h-[calc(100vh-3rem)]
        "
      >
        {mode === "signin" ? (
          <SigninModal
            onSwitchToSignup={() => setMode("signup")}
            onSuccess={handleSigninSuccess}
          />
        ) : (
          <SignupModal
            onSwitchToSignin={() => setMode("signin")}
            onSuccess={handleSigninSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

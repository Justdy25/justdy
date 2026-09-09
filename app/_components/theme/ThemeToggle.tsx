"use client";

import { Moon, Sun } from "lucide-react";

import { useJustdyTheme } from "./JustdyThemeProvider";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  className = "",
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useJustdyTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        disabled
        className={[
          "inline-flex size-9 items-center justify-center",
          "rounded-xl border border-border",
          "bg-background text-muted-foreground",
          "opacity-70",
          className,
        ].join(" ")}
      >
        <Moon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "group inline-flex items-center justify-center gap-2",
        "rounded-xl border border-border",
        "bg-background text-foreground",
        "transition-all duration-200",
        "hover:bg-muted hover:shadow-sm",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring/50",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
        className,
      ].join(" ")}
    >
      <span className="relative flex size-4 items-center justify-center">
        <Sun
          className={[
            "absolute size-4 transition-all duration-200",
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100",
          ].join(" ")}
          aria-hidden="true"
        />

        <Moon
          className={[
            "absolute size-4 transition-all duration-200",
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0",
          ].join(" ")}
          aria-hidden="true"
        />
      </span>

      {showLabel && (
        <span className="text-sm font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}

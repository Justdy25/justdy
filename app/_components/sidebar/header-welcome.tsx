"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  LogOut,
  Moon,
  ChevronRight,
  Languages,
} from "lucide-react";

import { SidebarTrigger } from "@/app/_components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface SiteHeaderProps {
  userName?: string;
  userImage?: string;
}

export function SiteHeader({
  userName: initialUserName,
  userImage: initialUserImage,
}: SiteHeaderProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const user = session?.user;

  const userName = initialUserName || user?.name || "Justdy User";

  const userImage = initialUserImage || user?.image || "";

  const userEmail = user?.email || "";

  const userHandle =
    `@${userName.replace(/\s+/g, "").toLowerCase()}` || "@user";

  const userInitials = userName
    ? userName
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "JU";

  const handleLogout = async () => {
    router.push("/");
  };

  return (
    <header
      className="
        sticky
        top-0
        z-30
        flex
        h-16
        w-full
        items-center
        justify-between
        border-b
        border-slate-200
        bg-white/95
        px-4
        text-slate-900
        shadow-[0_1px_3px_rgba(0,0,0,0.03)]
        backdrop-blur
        transition-all

        sm:px-6
        lg:px-8
      "
    >
      {/* ============================================================
          LEFT
      ============================================================ */}

      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          className="
            size-9
            shrink-0
            rounded-lg
            border
            border-slate-200
            bg-white
            text-slate-500
            shadow-sm
            transition-all
            hover:bg-slate-50
            hover:text-slate-900
            hover:shadow
          "
        />

        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        <div className="flex min-w-0 items-center">
          <span className="truncate text-sm font-semibold text-slate-800">
            Justdy AI
          </span>
        </div>
      </div>

      {/* ============================================================
          CENTER
      ============================================================ */}

      <div className="hidden flex-1 md:block" />

      {/* ============================================================
          RIGHT
      ============================================================ */}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Notifications */}

        <button
          type="button"
          title="Notifications"
          aria-label="Notifications"
          className="
            relative
            flex
            size-9
            items-center
            justify-center
            rounded-lg
            text-slate-500
            transition-colors
            hover:bg-slate-100
            hover:text-slate-900
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#857938]
            focus-visible:ring-offset-2
          "
        >
          <Bell className="size-5" />

          {/* Notification indicator */}

          {/*
          <span
            className="
              absolute
              right-1.5
              top-1.5
              size-2
              rounded-full
              bg-red-600
              ring-2
              ring-white
            "
          />
          */}
        </button>

        {/* Divider */}

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

        {/* User */}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open user menu"
              className="
                ml-1
                rounded-full
                outline-none
                focus-visible:ring-2
                focus-visible:ring-[#857938]
                focus-visible:ring-offset-2
              "
            >
              <Avatar
                className="
                  size-9
                  cursor-pointer
                  border
                  border-slate-200
                  shadow-sm
                  transition-all
                  hover:border-slate-300
                  hover:shadow
                "
              >
                <AvatarImage
                  src={userImage}
                  alt={userName}
                  className="object-cover"
                />

                <AvatarFallback
                  suppressHydrationWarning
                  className="
                    bg-slate-100
                    text-xs
                    font-semibold
                    text-slate-700
                  "
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="
              w-80
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-1
              text-slate-900
              shadow-2xl
            "
          >
            {/* USER INFORMATION */}

            <DropdownMenuLabel className="p-4 font-normal">
              <div className="flex items-center gap-4">
                <Avatar className="size-12 border border-slate-200">
                  <AvatarImage
                    src={userImage}
                    alt={userName}
                    className="object-cover"
                  />

                  <AvatarFallback className="bg-slate-100 text-lg font-semibold text-slate-700">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {userName}
                  </p>

                  <p className="truncate text-sm text-slate-500">
                    {userEmail || userHandle}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-slate-200" />

            <DropdownMenuGroup className="p-1">
              {/* My Courses */}

              <DropdownMenuItem
                asChild
                className="
                  cursor-pointer
                  rounded-xl
                  p-2.5
                  text-slate-700
                  transition-colors
                  focus:bg-slate-50
                  focus:text-slate-900
                "
              >
                <Link
                  href="/courses"
                  className="flex w-full items-center gap-4"
                >
                  <BookOpen className="size-5 text-slate-500" />

                  <span className="flex-1 text-sm font-medium">My Courses</span>
                </Link>
              </DropdownMenuItem>

              {/* Appearance */}

              <DropdownMenuItem
                className="
                  cursor-pointer
                  rounded-xl
                  p-2.5
                  text-slate-700
                  transition-colors
                  focus:bg-slate-50
                  focus:text-slate-900
                "
              >
                <div className="flex w-full items-center gap-4">
                  <Moon className="size-5 text-slate-500" />

                  <span className="flex-1 text-sm font-medium">Appearance</span>

                  <ChevronRight className="size-4 text-slate-400" />
                </div>
              </DropdownMenuItem>

              {/* Language */}

              <DropdownMenuItem
                className="
                  cursor-pointer
                  rounded-xl
                  p-2.5
                  text-slate-700
                  transition-colors
                  focus:bg-slate-50
                  focus:text-slate-900
                "
              >
                <div className="flex w-full items-center gap-4">
                  <Languages className="size-5 text-slate-500" />

                  <span className="flex-1 text-sm font-medium">
                    Display Language
                  </span>

                  <ChevronRight className="size-4 text-slate-400" />
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-slate-200" />

            {/* SIGN OUT */}

            <DropdownMenuGroup className="p-1">
              <DropdownMenuItem
                onClick={handleLogout}
                className="
      flex
      cursor-pointer
      items-center
      gap-4
      rounded-xl
      p-2.5
      text-slate-700
      transition-colors
      focus:bg-red-50
      focus:text-red-600
    "
              >
                <LogOut className="size-5 text-slate-500" />

                <span className="flex-1 text-sm font-medium">
                  Exit Dashboard
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

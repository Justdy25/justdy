"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Columns,
  CreditCard,
  Calendar,
  HelpCircleIcon,
  LucideIcon,
  GraduationCap,
  Library,
  Receipt,
  BookOpen,
  ListTree,
  Video,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "../ui/sidebar";

import { authClient } from "@/lib/auth-client";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { IconCash } from "@tabler/icons-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string;
  roles?: string[];
}

// Unified Management & Learner routes
const navigationData: Record<string, NavItem[]> = {
  manage: [
    {
      title: "Dashboard",
      url: "/manage",
      icon: LayoutDashboard,
      roles: ["admin", "educator"],
    },
    {
      title: "Justdy AI",
      url: "/manage/ai",
      icon: Sparkles,
      roles: ["admin", "educator"],
    },

    {
      title: "Products",
      url: "/manage/products",
      icon: Columns,
      roles: ["admin", "educator"],
    },

    {
      title: "Subjects & Topics",
      url: "/manage/subjects-topics",
      icon: ListTree,
      roles: ["admin"],
    },

    {
      title: "Educators",
      url: "/manage/educators",
      icon: GraduationCap,
      roles: ["admin"],
    },

    {
      title: "Student Roster",
      url: "/manage/roster",
      icon: Users,
      roles: ["admin", "educator"],
    },

    {
      title: "Sessions",
      url: "/manage/sessions",
      icon: Calendar,
      roles: ["admin", "educator"],
    },

    {
      title: "Payouts & Earnings",
      url: "/manage/payouts",
      icon: CreditCard,
      roles: ["admin", "educator"],
    },

    {
      title: "Transactions",
      url: "/manage/transactions",
      icon: Receipt,
      roles: ["admin"],
    },

    {
      title: "My Portfolio",
      url: "/manage/portfolio",
      icon: IconCash,
      roles: ["admin", "educator"],
    },

    {
      title: "Settings",
      url: "/manage/settings",
      icon: Settings,
      roles: ["admin", "educator"],
    },
  ],

  learner: [
    {
      title: "Dashboard",
      url: "/learner",
      icon: LayoutDashboard,
    },
    {
      title: "My Products",
      url: "/learner/products",
      icon: Calendar,
    },
    {
      title: "Settings",
      url: "/learner/settings",
      icon: Settings,
    },
  ],
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  educator: "Educator",
  learner: "Learner",
  facilitator: "Facilitator",
};

const secondaryNav: NavItem[] = [
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
  {
    title: "Send feedback",
    url: "#",
    icon: HelpCircleIcon,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userRoles?: string[];
  permissions?: string[];
}

export function AppSidebar({ userRoles = [], ...props }: AppSidebarProps) {
  const pathname = usePathname();

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { data: session } = authClient.useSession();

  const user = session?.user;

  const userName = user?.name || "User";
  const userImage = user?.image || "";

  const userInitials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  // --------------------------------------------------
  // Collect and normalize roles
  // --------------------------------------------------

  const rolesList = [...userRoles];

  if (user) {
    const userObj = user as {
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

  const normalizedRoles = rolesList.map((r) => r.toLowerCase());

  // --------------------------------------------------
  // Determine primary role and dashboard section
  // --------------------------------------------------

  const isManagement = ["admin", "educator", "facilitator"].some((r) =>
    normalizedRoles.includes(r),
  );

  const activeRoleKey = isManagement ? "manage" : "learner";

  const primaryRole = normalizedRoles.includes("admin")
    ? "admin"
    : normalizedRoles.includes("educator")
      ? "educator"
      : normalizedRoles.includes("facilitator")
        ? "facilitator"
        : "learner";

  const activeRoleLabel = roleLabels[primaryRole] ?? "Learner";

  // --------------------------------------------------
  // Filter navigation according to roles
  // --------------------------------------------------

  const navGroups = (
    navigationData[activeRoleKey] ?? navigationData.learner
  ).filter((item) => {
    if (!item.roles) return true;

    return item.roles.some((role) => normalizedRoles.includes(role));
  });

  if (!mounted) {
    return <Sidebar {...props} />;
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      className="
        border-r
        border-gray-200
        bg-white
        text-gray-900
        p-0
      "
      {...props}
    >
      {/* ==================================================
          BRAND HEADER
      ================================================== */}

      {/* ==================================================
          PROFILE CARD
      ================================================== */}

      <div
        className="
          flex
          flex-col
          items-center
          justify-center
          py-6
          px-4
          border-b
          border-gray-200
          bg-white
          space-y-2
        "
      >
        <Avatar
          className="
            w-20
            h-20
            border
            border-gray-200
            shadow-sm
          "
        >
          <AvatarImage
            src={userImage}
            alt={userName}
            className="object-cover"
          />

          <AvatarFallback
            className="
              bg-gray-100
              text-gray-700
              font-semibold
              text-lg
            "
          >
            {userInitials}
          </AvatarFallback>
        </Avatar>

        <div className="text-center pt-1">
          <span
            className="
              block
              text-[11px]
              font-medium
              text-gray-500
              capitalize
              tracking-wide
            "
          >
            {activeRoleLabel}
          </span>

          <h3
            className="
              text-sm
              font-semibold
              text-gray-900
              truncate
              max-w-45
              mt-0.5
            "
          >
            {userName}
          </h3>
        </div>
      </div>

      {/* ==================================================
          MAIN NAVIGATION
      ================================================== */}

      <SidebarContent
        className="
          px-2
          py-4
          bg-white
        "
      >
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navGroups.map((item, index) => {
                const Icon = item.icon;

                const isExact = pathname === item.url;

                const isRootPath =
                  index === 0 ||
                  item.url === "/manage" ||
                  item.url === "/learner";

                const isNested =
                  !isRootPath && pathname?.startsWith(`${item.url}/`);

                const isActive = isExact || isNested;

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        h-10
                        px-3
                        rounded-lg
                        text-sm
                        font-medium
                        transition-all
                        duration-200
                        group
                        ${
                          isActive
                            ? `
                              bg-red-50
                              text-red-600
                              font-semibold
                              border-l-4
                              border-red-600
                              rounded-l-none
                            `
                            : `
                              text-gray-600
                              hover:text-gray-900
                              hover:bg-gray-50
                            `
                        }
                      `}
                    >
                      <Link
                        href={item.url}
                        className="
                          flex
                          items-center
                          justify-between
                          w-full
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >
                          <Icon
                            className={`
                              w-5
                              h-5
                              shrink-0
                              transition-colors
                              duration-200
                              ${
                                isActive
                                  ? "text-red-600"
                                  : "text-gray-500 group-hover:text-gray-700"
                              }
                            `}
                          />

                          <span>{item.title}</span>
                        </div>

                        {item.badge && (
                          <span
                            className="
                              px-1.5
                              py-0.5
                              rounded-md
                              text-[10px]
                              bg-red-50
                              text-red-600
                              border
                              border-red-100
                              font-semibold
                            "
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ==================================================
          FOOTER NAVIGATION
      ================================================== */}

      <SidebarFooter
        className="
          p-2
          border-t
          border-gray-200
          bg-white
        "
      >
        <SidebarMenu className="space-y-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className="
                    h-9
                    px-3
                    rounded-lg
                    text-sm
                    font-medium
                    text-gray-500
                    transition-colors
                    duration-200
                    hover:text-gray-900
                    hover:bg-gray-50
                  "
                >
                  <Link
                    href={item.url}
                    className="
                      flex
                      items-center
                      gap-3
                      w-full
                    "
                  >
                    <Icon
                      className="
                        w-5
                        h-5
                        shrink-0
                        text-gray-500
                      "
                    />

                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

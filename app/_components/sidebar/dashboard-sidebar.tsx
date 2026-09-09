"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  AudioLines,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Code2,
  FileText,
  FolderKanban,
  ImageIcon,
  LibraryBig,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Video,
  WalletCards,
  WandSparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { authClient } from "@/lib/auth-client";
import MyLogo from "../Logo";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

/* ============================================================
   MAIN NAVIGATION
============================================================ */

const mainNavigation: NavItem[] = [
  {
    title: "New",
    url: "/dashboard",
    icon: Plus,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Artifacts",
    url: "/library",
    icon: LibraryBig,
  },
  {
    title: "Customize",
    url: "/settings",
    icon: Settings2,
  },
];

/* ============================================================
   CREATION NAVIGATION
============================================================ */

const creationNavigation: NavItem[] = [
  {
    title: "All creations",
    url: "/create",
    icon: WandSparkles,
  },
  {
    title: "Worksheet",
    url: "/create/worksheet",
    icon: ClipboardCheck,
  },
  {
    title: "Video",
    url: "/create/video",
    icon: Video,
  },
  {
    title: "Image",
    url: "/create/image",
    icon: ImageIcon,
  },
  {
    title: "Audio",
    url: "/create/audio",
    icon: AudioLines,
  },
  {
    title: "Document",
    url: "/create/document",
    icon: FileText,
  },
  {
    title: "Lesson",
    url: "/create/lesson",
    icon: BookOpen,
  },
  {
    title: "Quiz",
    url: "/create/quiz",
    icon: ClipboardCheck,
  },
];

/* ============================================================
   ACCOUNT NAVIGATION
============================================================ */

const accountNavigation: NavItem[] = [
  {
    title: "Credits",
    url: "/credits",
    icon: WalletCards,
  },
];

/* ============================================================
   CONVERSATION TYPES
============================================================ */

interface Conversation {
  id: string;
  title: string;
  model: string | null;
  status: "ACTIVE";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/* ============================================================
   HELPERS
============================================================ */

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getConversationTitle(title: string) {
  return title.trim() || "New conversation";
}

/* ============================================================
   CHAT HISTORY
============================================================ */

function ChatHistorySection({ projectId }: { projectId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeConversationId = searchParams.get("conversationId");

  const [conversations, setConversations] = React.useState<Conversation[]>([]);

  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const loadConversations = React.useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (projectId) {
        params.set("projectId", projectId);
      }

      const response = await fetch(
        `/api/ai/chat${params.toString() ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
        },
      );

      const data = (await response.json()) as {
        conversations?: Conversation[];
      };

      if (response.ok) {
        setConversations(data.conversations ?? []);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /*
   * Defer the initial load so the effect does not synchronously
   * trigger a cascading render through setLoading/setConversations.
   */
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversations();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadConversations]);

  React.useEffect(() => {
    const refresh = () => {
      void loadConversations();
    };

    window.addEventListener("justdy:chat-updated", refresh);

    return () => {
      window.removeEventListener("justdy:chat-updated", refresh);
    };
  }, [loadConversations]);

  const filteredConversations = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      getConversationTitle(conversation.title).toLowerCase().includes(query),
    );
  }, [conversations, search]);

  const chatHref = projectId
    ? `/chat?projectId=${encodeURIComponent(projectId)}`
    : "/chat";

  const conversationHref = (conversationId: string) => {
    const params = new URLSearchParams();

    params.set("conversationId", conversationId);

    if (projectId) {
      params.set("projectId", projectId);
    }

    return `/chat?${params.toString()}`;
  };

  async function archiveConversation(conversation: Conversation) {
    if (archivingId) {
      return;
    }

    const title = getConversationTitle(conversation.title);

    if (!window.confirm(`Archive "${title}"?`)) {
      return;
    }

    setArchivingId(conversation.id);

    try {
      const params = new URLSearchParams({
        conversationId: conversation.id,
      });

      if (projectId) {
        params.set("projectId", projectId);
      }

      const response = await fetch(`/api/ai/chat?${params.toString()}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
        };

        throw new Error(data.error ?? "Unable to archive conversation.");
      }

      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );

      if (activeConversationId === conversation.id) {
        router.push(chatHref);
      }

      window.dispatchEvent(new Event("justdy:chat-updated"));
    } catch (error) {
      console.error("Failed to archive conversation:", error);
    } finally {
      setArchivingId(null);
    }
  }

  if (pathname !== "/chat" && pathname !== "/dashboard") {
    return null;
  }

  return (
    <SidebarGroup className="mt-4 min-h-0 flex-1 p-0">
      <div className="flex items-center justify-between px-3 pb-2">
        <SidebarGroupLabel className="p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Chats and tasks
        </SidebarGroupLabel>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Chat options"
            title="Chat options"
          >
            <SlidersHorizontal className="size-3.5" />
          </button>

          <Link
            href={chatHref}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="size-4" />
          </Link>
        </div>
      </div>

      <SidebarGroupContent className="min-h-0 flex-1">
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        <div className="max-h-[min(42vh,420px)] overflow-y-auto px-1.5 [scrollbar-width:thin]">
          {loading ? (
            <div className="space-y-1 px-1 py-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare className="mx-auto size-4 text-slate-300" />

              <p className="mt-2 text-xs font-medium text-slate-600">
                {search ? "No chats found" : "No conversations yet"}
              </p>

              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                {search ? "Try another search." : "Start a new chat."}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((conversation) => {
                const active = conversation.id === activeConversationId;

                return (
                  <div
                    key={conversation.id}
                    className={`group flex min-w-0 items-center rounded-lg transition ${
                      active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Link
                      href={conversationHref(conversation.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2"
                      aria-current={active ? "page" : undefined}
                    >
                      <MessageSquare
                        className={`size-3.5 shrink-0 ${
                          active ? "text-slate-700" : "text-slate-400"
                        }`}
                      />

                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {getConversationTitle(conversation.title)}
                      </span>

                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatRelativeTime(conversation.updatedAt)}
                      </span>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={archivingId === conversation.id}
                          className="mr-1 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          aria-label={`Actions for ${getConversationTitle(
                            conversation.title,
                          )}`}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        side="right"
                        className="w-36 rounded-xl"
                      >
                        <DropdownMenuItem
                          onClick={() => void archiveConversation(conversation)}
                          className="gap-2 text-xs text-slate-600 focus:text-red-600"
                        >
                          <Archive className="size-3.5" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/* ============================================================
   SIDEBAR
============================================================ */

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: session } = authClient.useSession();

  const user = session?.user;

  const projectId = searchParams.get("projectId");
  const conversationId = searchParams.get("conversationId");

  const isChat = pathname === "/chat" || pathname === "/dashboard";

  /*
   * Create is independent from Projects.
   *
   * The initial value automatically opens the menu when the
   * sidebar is first rendered on a creation route.
   *
   * No effect is needed here.
   */
  const isCreationRoute =
    pathname === "/create" || pathname?.startsWith("/create/");

  const [createOpen, setCreateOpen] = React.useState(isCreationRoute);

  const userName = user?.name || "Justdy User";

  const userImage = user?.image || "";

  const userInitials =
    userName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "JU";

  const isActive = (url: string) => {
    if (url === "/dashboard") {
      return (
        (pathname === "/dashboard" || pathname === "/chat") && !conversationId
      );
    }

    if (url === "/projects") {
      return pathname === "/projects" || pathname?.startsWith("/projects/");
    }

    if (url === "/library") {
      return pathname === "/library" || pathname?.startsWith("/library/");
    }

    if (url === "/settings") {
      return pathname === "/settings" || pathname?.startsWith("/settings/");
    }

    return pathname === url || pathname?.startsWith(`${url}/`);
  };

  const renderNavigation = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.url);

      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            asChild
            isActive={active}
            tooltip={item.title}
            className={`h-10 rounded-lg px-3 text-[13px] font-medium transition-colors ${
              active
                ? "bg-slate-100 text-slate-950"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <Link href={item.url}>
              <Icon
                className={`size-[17px] shrink-0 ${
                  active ? "text-slate-800" : "text-slate-400"
                }`}
              />

              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  function handleNewChat() {
    const params = new URLSearchParams();

    if (projectId) {
      params.set("projectId", projectId);
    }

    /*
     * A unique token makes every click a real navigation,
     * even when the user is already on /dashboard.
     */
    params.set("new", Date.now().toString());

    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-slate-200 bg-white text-slate-900 [--sidebar-width:280px]"
      {...props}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <SidebarHeader className="shrink-0 border-b border-slate-100 bg-white px-4 py-4">
        <div className="flex min-w-0 items-center">
          <MyLogo />
        </div>
      </SidebarHeader>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <SidebarContent className="min-h-0 bg-white px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {/* ==================================================
                  NEW
              ================================================== */}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  onClick={handleNewChat}
                  isActive={isActive("/dashboard")}
                  tooltip="New"
                  className={`h-10 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                    isActive("/dashboard")
                      ? "bg-slate-100 text-slate-950"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <Plus
                    className={`size-[17px] shrink-0 ${
                      isActive("/dashboard")
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  />

                  <span>New</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* ==================================================
                  PROJECTS
              ================================================== */}

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/projects")}
                  tooltip="Projects"
                  className={`h-10 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                    isActive("/projects")
                      ? "bg-slate-100 text-slate-950"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <Link href="/projects">
                    <FolderKanban
                      className={`size-[17px] shrink-0 ${
                        isActive("/projects")
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    />

                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* ==================================================
                  CREATE
              ================================================== */}

              <SidebarMenuItem>
                <div className="flex items-center gap-1">
                  <SidebarMenuButton
                    type="button"
                    onClick={() => setCreateOpen((value) => !value)}
                    isActive={isCreationRoute}
                    tooltip="Create"
                    className={`h-10 min-w-0 flex-1 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                      isCreationRoute
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <WandSparkles
                      className={`size-[17px] shrink-0 ${
                        isCreationRoute ? "text-slate-800" : "text-slate-400"
                      }`}
                    />

                    <span>Create</span>
                  </SidebarMenuButton>

                  <button
                    type="button"
                    onClick={() => setCreateOpen((value) => !value)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    aria-label={
                      createOpen ? "Collapse create menu" : "Expand create menu"
                    }
                    aria-expanded={createOpen}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        createOpen ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                </div>

                {createOpen && (
                  <div className="ml-4 mt-1 border-l border-slate-200 pl-2">
                    <SidebarMenu className="space-y-0.5">
                      {creationNavigation.map((item) => {
                        const Icon = item.icon;

                        const active =
                          pathname === item.url ||
                          pathname?.startsWith(`${item.url}/`);

                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              asChild
                              isActive={active}
                              tooltip={item.title}
                              className={`h-9 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                                active
                                  ? "bg-slate-100 text-slate-900"
                                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <Link href={item.url}>
                                <Icon
                                  className={`size-3.5 shrink-0 ${
                                    active ? "text-slate-700" : "text-slate-400"
                                  }`}
                                />

                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </div>
                )}
              </SidebarMenuItem>

              {/* ==================================================
                  ARTIFACTS
              ================================================== */}

              {renderNavigation(
                mainNavigation.filter((item) => item.title === "Artifacts"),
              )}

              {/* ==================================================
                  CODE
              ================================================== */}

              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  tooltip="Code"
                  className="h-10 rounded-lg px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                >
                  <Code2 className="size-[17px] shrink-0 text-slate-400" />

                  <span>Code</span>

                  <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                    Soon
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* ==================================================
                  CUSTOMIZE
              ================================================== */}

              {renderNavigation(
                mainNavigation.filter((item) => item.title === "Customize"),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ======================================================
            CHAT HISTORY
        ====================================================== */}

        {isChat && <ChatHistorySection projectId={projectId} />}

        {/* ======================================================
            ACCOUNT
        ====================================================== */}

        <SidebarGroup className="mt-4 p-0">
          <SidebarGroupLabel className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Account
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {renderNavigation(accountNavigation)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <SidebarFooter className="border-t border-slate-100 bg-white p-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-xl p-2 transition hover:bg-slate-50"
        >
          <Avatar className="size-8 border border-slate-200">
            <AvatarImage
              src={userImage}
              alt={userName}
              className="object-cover"
            />

            <AvatarFallback className="bg-slate-100 text-[11px] font-semibold text-slate-700">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">
              {userName}
            </p>

            <p className="truncate text-[10px] text-slate-400">
              Justdy account
            </p>
          </div>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}

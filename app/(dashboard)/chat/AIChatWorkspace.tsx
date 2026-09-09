"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Pencil,
  Paperclip,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Square,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import {
  FormEvent,
  isValidElement,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import ProjectContextIndicator from "@/app/_components/ProjectContextIndicator";
import remarkGfm from "remark-gfm";
import type { WorksheetDocument } from "@/lib/ai/worksheet/schema";

interface AIChatWorkspaceProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  initialPrompt?: string;
  projectId?: string | null;
  initialConversationId?: string | null;
  startNewChatOnLoad?: boolean;
  newChatToken?: string;
}

interface ChatAttachment {
  assetId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
}

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  generationId?: string | null;
  videoGenerationId?: string | null;
  parentMessageId?: string | null;
  attachments?: ChatAttachment[];
  branchIndex?: number;
  branchCount?: number;
  metadata?: {
    type?: string;
    worksheet?: WorksheetDocument;
    image?: {
      generationId: string;
      assetId: string;
      url: string;
      mimeType: string;
      model: string;
      size: string;
      quality: string;
      prompt: string;
    };
    requestId?: string;
    command?: Record<string, unknown>;
  } | null;
}

interface Conversation {
  id: string;
  title: string;
  model: string | null;
  status: "ACTIVE";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationsResponse {
  conversations: Conversation[];
  credits: {
    balance: number;
  };
}

interface ConversationPagination {
  limit: number;
  hasMore: boolean;
  nextCursor: {
    createdAt: string;
    id: string;
  } | null;
}

interface ConversationResponse {
  conversation: {
    id: string;
    title: string;
    model: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: ChatMessage[];
  pagination?: ConversationPagination;
}

interface ChatVideoGeneration {
  id: string;
  title?: string | null;
  prompt?: string;
  style?: string | null;
  duration?: number;
  aspectRatio?: string;
  provider?: string;
  model?: string;
  providerTaskId?: string | null;
  status:
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  creditsUsed?: number;
  errorMessage?: string | null;
  completedAt?: string | null;
}

interface ChatVideoStatusResponse {
  success?: boolean;
  generation?: ChatVideoGeneration;
  error?: string;
}

function getConversationTitle(title: string) {
  const normalized = title.trim();
  return normalized || "New conversation";
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ============================================================
   MAIN
============================================================ */

export default function AIChatWorkspace({
  user,
  initialPrompt = "",
  projectId = null,
  initialConversationId = null,
  startNewChatOnLoad = false,
}: AIChatWorkspaceProps) {
  function persistConversationInUrl(conversationId: string) {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.set("conversationId", conversationId);

    if (projectId) {
      url.searchParams.set("projectId", projectId);
    } else {
      url.searchParams.delete("projectId");
    }

    window.history.replaceState(window.history.state, "", url.toString());
  }
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState(initialPrompt);

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  const [videoGenerations, setVideoGenerations] = useState<
    Record<string, ChatVideoGeneration>
  >({});
  const videoPollingIdsRef = useRef<Set<string>>(new Set());

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [switchingBranchMessageId, setSwitchingBranchMessageId] = useState<
    string | null
  >(null);

  type FailedGeneration = {
    action: "retry" | "regenerate" | "edit";
    message?: string;
    userMessageId?: string;
    assistantMessageId?: string;
  };

  const [failedGeneration, setFailedGeneration] =
    useState<FailedGeneration | null>(null);

  const failedGenerationRef = useRef<FailedGeneration | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const activeConversationStorageKey = `justdy-ai-active-conversation:${user.id}:${projectId ?? "general"}`;

  const resizeComposer = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const maxHeight = 192;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const resetComposerHeight = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "58px";
    textarea.style.overflowY = "hidden";
  }, []);

  // Generation/conversation race protection.
  const generationRunIdRef = useRef(0);
  const activeGenerationRunIdRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);
  const conversationLoadIdRef = useRef(0);
  const activeConversationIdRef = useRef<string | null>(null);

  // Smart auto-scroll state for the message viewport.
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);

  // Conversation history pagination. The initial page contains the newest
  // messages; older pages are loaded only when the user reaches the top.
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const olderMessagesCursorRef =
    useRef<ConversationPagination["nextCursor"]>(null);
  const prependScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const olderLoadConversationIdRef = useRef<string | null>(null);

  /* ==========================================================
     VIDEO GENERATION STATUS
  ========================================================== */

  const pollChatVideoGeneration = useCallback(async (generationId: string) => {
    if (videoPollingIdsRef.current.has(generationId)) {
      return;
    }

    videoPollingIdsRef.current.add(generationId);

    try {
      const maxAttempts = 120;
      const interval = 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(
          `/api/ai/video/${encodeURIComponent(generationId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const data = (await response.json()) as ChatVideoStatusResponse;

        if (!response.ok || !data.generation) {
          throw new Error(
            data.error ?? "Unable to check video generation status.",
          );
        }

        const generation = data.generation;

        setVideoGenerations((current) => ({
          ...current,
          [generation.id]: generation,
        }));

        if (
          generation.status === "COMPLETED" ||
          generation.status === "FAILED" ||
          generation.status === "CANCELLED"
        ) {
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, interval);
        });
      }
    } catch (err) {
      console.error("Failed to poll video generation:", err);
      setVideoGenerations((current) => ({
        ...current,
        [generationId]: {
          ...(current[generationId] ?? { id: generationId }),
          id: generationId,
          status: "FAILED",
          errorMessage:
            err instanceof Error
              ? err.message
              : "Unable to check video generation status.",
        },
      }));
    } finally {
      videoPollingIdsRef.current.delete(generationId);
    }
  }, []);

  useEffect(() => {
    const generationIds = messages
      .filter(
        (message) => message.role === "ASSISTANT" && message.videoGenerationId,
      )
      .map((message) => message.videoGenerationId!)
      .filter((id, index, all) => all.indexOf(id) === index);

    for (const generationId of generationIds) {
      const current = videoGenerations[generationId];

      if (
        !current ||
        (current.status !== "COMPLETED" &&
          current.status !== "FAILED" &&
          current.status !== "CANCELLED")
      ) {
        void pollChatVideoGeneration(generationId);
      }
    }
  }, [messages, pollChatVideoGeneration, videoGenerations]);

  /* ==========================================================
     LOAD CONVERSATIONS
  ========================================================== */

  /* ==========================================================
     LOAD INITIAL DATA
  ========================================================== */

  async function retryFailedGeneration() {
    const failed = failedGenerationRef.current;

    if (!failed) {
      return;
    }

    failedGenerationRef.current = null;
    setFailedGeneration(null);

    await runChatAction({
      action: failed.action,
      ...(failed.message ? { message: failed.message } : {}),
      ...(failed.userMessageId ? { userMessageId: failed.userMessageId } : {}),
      ...(failed.assistantMessageId
        ? { assistantMessageId: failed.assistantMessageId }
        : {}),
    });
  }

  const loadConversation = useCallback(
    async (conversationId: string) => {
      const loadId = conversationLoadIdRef.current + 1;
      conversationLoadIdRef.current = loadId;

      setIsLoadingHistory(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ai/chat?conversationId=${encodeURIComponent(conversationId)}${
            projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
          }`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load conversation.");
        }

        // Ignore results from an older conversation load.
        if (
          conversationLoadIdRef.current !== loadId ||
          activeConversationIdRef.current !== conversationId
        ) {
          return;
        }

        const result = data as ConversationResponse;
        const pagination = result.pagination;

        setMessages(result.messages ?? []);
        setActiveConversationId(result.conversation?.id ?? conversationId);
        setHasMoreMessages(pagination?.hasMore ?? false);
        olderMessagesCursorRef.current = pagination?.nextCursor ?? null;
        olderLoadConversationIdRef.current = conversationId;
        prependScrollRef.current = null;
      } catch (err) {
        // A newer load has taken over this request.
        if (
          conversationLoadIdRef.current !== loadId ||
          activeConversationIdRef.current !== conversationId
        ) {
          return;
        }

        console.error("Failed to load conversation:", err);

        setError(
          err instanceof Error ? err.message : "Unable to load conversation.",
        );
      } finally {
        if (conversationLoadIdRef.current === loadId) {
          setIsLoadingHistory(false);
        }
      }
    },
    [projectId],
  );

  const hasMountedConversationSelectionRef = useRef(false);
  const initialConversationIdRef = useRef(initialConversationId);
  const startNewChatOnLoadRef = useRef(startNewChatOnLoad);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setIsLoadingHistory(true);
      setError(null);

      try {
        const response = await fetch(
          projectId
            ? `/api/ai/chat?projectId=${encodeURIComponent(projectId)}`
            : "/api/ai/chat",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load AI conversations.");
        }

        if (cancelled) {
          return;
        }

        const availableConversations = (data.conversations ??
          []) as Conversation[];

        setConversations(availableConversations);
        setCreditsRemaining(data.credits?.balance ?? 0);

        if (
          startNewChatOnLoadRef.current &&
          !initialConversationIdRef.current
        ) {
          setActiveConversationId(null);
          activeConversationIdRef.current = null;
          setMessages([]);
          setHasMoreMessages(false);
          olderMessagesCursorRef.current = null;
          setError(null);
          return;
        }

        if (availableConversations.length > 0) {
          const requestedConversation = initialConversationIdRef.current
            ? availableConversations.find(
                (conversation) =>
                  conversation.id === initialConversationIdRef.current,
              )
            : null;

          const storedConversationId =
            typeof window !== "undefined"
              ? window.localStorage.getItem(activeConversationStorageKey)
              : null;

          const storedConversation = storedConversationId
            ? availableConversations.find(
                (conversation) => conversation.id === storedConversationId,
              )
            : null;

          const conversationToLoad =
            requestedConversation ??
            storedConversation ??
            availableConversations[0];

          activeConversationIdRef.current = conversationToLoad.id;
          setActiveConversationId(conversationToLoad.id);

          await loadConversation(conversationToLoad.id);
        } else {
          activeConversationIdRef.current = null;
          setActiveConversationId(null);
          setMessages([]);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Failed to initialize AI chat:", err);

        setError(
          err instanceof Error ? err.message : "Unable to load AI chat.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void initialize();

    const videoPollingIds = videoPollingIdsRef.current;

    return () => {
      cancelled = true;
      generationRunIdRef.current += 1;
      activeGenerationRunIdRef.current = null;
      conversationLoadIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      isLoadingRef.current = false;
      videoPollingIds.clear();
    };
  }, [activeConversationStorageKey, loadConversation, projectId]);

  // URL conversation changes are handled independently from initial data
  // loading. This prevents a sidebar click from refetching the entire
  // conversation list and credit balance before loading the selected chat.
  useEffect(() => {
    if (!hasMountedConversationSelectionRef.current) {
      hasMountedConversationSelectionRef.current = true;
      return;
    }

    if (startNewChatOnLoad && !initialConversationId) {
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
      setHasMoreMessages(false);
      olderMessagesCursorRef.current = null;
      setError(null);
      return;
    }

    if (!initialConversationId) {
      return;
    }

    if (activeConversationIdRef.current === initialConversationId) {
      return;
    }

    activeConversationIdRef.current = initialConversationId;
    setActiveConversationId(initialConversationId);
    setMessages([]);
    setHasMoreMessages(false);
    olderMessagesCursorRef.current = null;

    void loadConversation(initialConversationId);
  }, [initialConversationId, loadConversation, startNewChatOnLoad]);

  /* ==========================================================
     LOAD ACTIVE CONVERSATION
  ========================================================== */

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeConversationId) {
      window.localStorage.setItem(
        activeConversationStorageKey,
        activeConversationId,
      );
    } else {
      window.localStorage.removeItem(activeConversationStorageKey);
    }
  }, [activeConversationId, activeConversationStorageKey]);

  /* ==========================================================
     LOAD OLDER MESSAGES
  ========================================================== */

  const loadOlderMessages = useCallback(async () => {
    const conversationId = activeConversationIdRef.current;
    const cursor = olderMessagesCursorRef.current;
    const container = messageScrollRef.current;

    if (
      !conversationId ||
      !cursor ||
      !hasMoreMessages ||
      isLoadingOlderMessages ||
      !container
    ) {
      return;
    }

    const loadConversationId = conversationId;
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    setIsLoadingOlderMessages(true);
    olderLoadConversationIdRef.current = loadConversationId;
    prependScrollRef.current = {
      scrollHeight: previousScrollHeight,
      scrollTop: previousScrollTop,
    };

    try {
      const params = new URLSearchParams({
        conversationId: loadConversationId,
        ...(projectId ? { projectId } : {}),
        limit: "50",
        beforeCreatedAt: cursor.createdAt,
        beforeId: cursor.id,
      });

      const response = await fetch(`/api/ai/chat?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as
        | ConversationResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to load older messages.",
        );
      }

      if (
        activeConversationIdRef.current !== loadConversationId ||
        olderLoadConversationIdRef.current !== loadConversationId
      ) {
        prependScrollRef.current = null;
        return;
      }

      const result = data as ConversationResponse;
      const olderMessages = result.messages ?? [];
      const pagination = result.pagination;

      setMessages((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const uniqueOlderMessages = olderMessages.filter(
          (item) => !existingIds.has(item.id),
        );

        return [...uniqueOlderMessages, ...current];
      });

      setHasMoreMessages(pagination?.hasMore ?? false);
      olderMessagesCursorRef.current = pagination?.nextCursor ?? null;
    } catch (err) {
      prependScrollRef.current = null;
      console.error("Failed to load older messages:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load older messages.",
      );
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [hasMoreMessages, isLoadingOlderMessages, projectId]);

  /* ==========================================================
     SMART AUTO-SCROLL
  ========================================================== */

  // Preserve the user's viewport when an older page is prepended.
  // This runs after React commits the new message list, before the browser paints.
  useLayoutEffect(() => {
    const pending = prependScrollRef.current;
    const container = messageScrollRef.current;

    if (!pending || !container) {
      return;
    }

    const heightDelta = container.scrollHeight - pending.scrollHeight;
    container.scrollTop = pending.scrollTop + heightDelta;
    prependScrollRef.current = null;
  }, [messages]);

  const isNearBottom = useCallback(() => {
    const container = messageScrollRef.current;

    if (!container) {
      return true;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom <= 96;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messageScrollRef.current;

    if (!container) {
      return;
    }

    shouldAutoScrollRef.current = true;
    setIsAwayFromBottom(false);

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const handleMessageScroll = useCallback(() => {
    const container = messageScrollRef.current;
    const nearBottom = isNearBottom();

    shouldAutoScrollRef.current = nearBottom;
    setIsAwayFromBottom(!nearBottom);

    if (container && container.scrollTop <= 120) {
      void loadOlderMessages();
    }
  }, [isNearBottom, loadOlderMessages]);

  // Follow a streaming response while the user remains near the bottom.
  // If the user scrolls upward, stop following until they return to the bottom
  // or explicitly press "Jump to latest".
  useEffect(() => {
    if (!isStreaming || !shouldAutoScrollRef.current) {
      return;
    }

    const container = messageScrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isStreaming]);

  // When a conversation is loaded or a new response is committed, start at
  // the latest content. This is intentionally instant rather than smooth so
  // history loading does not produce a distracting animation.
  useEffect(() => {
    if (messages.length === 0) {
      shouldAutoScrollRef.current = true;
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (shouldAutoScrollRef.current) {
        scrollToLatest("auto");
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeConversationId, messages.length, scrollToLatest]);

  // Keep the auto-scroll state synchronized when the viewport itself changes.
  useEffect(() => {
    const handleResize = () => {
      if (isNearBottom()) {
        shouldAutoScrollRef.current = true;
        setIsAwayFromBottom(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isNearBottom]);

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  type ChatAction = "send" | "retry" | "regenerate" | "edit";

  async function runChatAction({
    action,
    message,
    userMessageId,
    assistantMessageId,
    messageAttachments,
  }: {
    action: ChatAction;
    message?: string;
    userMessageId?: string;
    assistantMessageId?: string;
    messageAttachments?: ChatAttachment[];
  }) {
    if (isLoadingRef.current || isLoading || isUploadingFile) return;

    const trimmedMessage = message?.trim() ?? "";
    const activeAttachments =
      action === "send" ? (messageAttachments ?? attachments) : [];
    const effectiveMessage =
      trimmedMessage ||
      (activeAttachments.length > 0
        ? "Please analyze the attached file(s)."
        : "");

    if ((action === "send" || action === "edit") && !effectiveMessage) {
      return;
    }

    const runId = generationRunIdRef.current + 1;
    generationRunIdRef.current = runId;
    activeGenerationRunIdRef.current = runId;

    const requestConversationId = activeConversationIdRef.current;

    setError(null);
    failedGenerationRef.current = null;
    setFailedGeneration(null);
    setIsLoading(true);
    setIsStreaming(true);
    isLoadingRef.current = true;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const requestId = `request-${crypto.randomUUID()}`;

    const temporaryUserId =
      action === "send" || action === "edit" ? `temporary-user-${runId}` : null;
    const temporaryAssistantId = `temporary-assistant-${runId}`;

    if (action === "send") {
      const optimisticUserMessage: ChatMessage = {
        id: temporaryUserId!,
        role: "USER",
        content: effectiveMessage,
        createdAt: "",
        attachments: activeAttachments,
      };

      const optimisticAssistantMessage: ChatMessage = {
        id: temporaryAssistantId,
        role: "ASSISTANT",
        content: "",
        createdAt: "",
      };

      setMessages((current) => [
        ...current,
        optimisticUserMessage,
        optimisticAssistantMessage,
      ]);
      setInput("");
      setAttachments([]);
      resetComposerHeight();
    } else if (action === "retry") {
      setMessages((current) => [
        ...current,
        {
          id: temporaryAssistantId,
          role: "ASSISTANT",
          content: "",
          createdAt: "",
        },
      ]);
    } else if (action === "regenerate") {
      // Regeneration creates a new assistant branch. Never mutate the old
      // assistant response, even optimistically in the client.
      setMessages((current) => [
        ...current,
        {
          id: temporaryAssistantId,
          role: "ASSISTANT",
          content: "",
          createdAt: "",
        },
      ]);
    } else if (action === "edit" && userMessageId) {
      setMessages((current) => {
        const index = current.findIndex((item) => item.id === userMessageId);

        if (index < 0) return current;

        return [
          ...current
            .slice(0, index)
            .filter((item) => item.id !== temporaryAssistantId),
          {
            ...current[index],
            content: trimmedMessage,
          },
          {
            id: temporaryAssistantId,
            role: "ASSISTANT",
            content: "",
            createdAt: "",
          },
        ];
      });

      setEditingMessageId(null);
      setEditingText("");
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          action,
          conversationId: requestConversationId,
          ...(projectId ? { projectId } : {}),
          requestId,
          ...(effectiveMessage ? { message: effectiveMessage } : {}),
          ...(activeAttachments.length > 0
            ? {
                attachments: activeAttachments.map(
                  (attachment) => attachment.assetId,
                ),
              }
            : {}),
          ...(userMessageId ? { userMessageId } : {}),
          ...(assistantMessageId ? { assistantMessageId } : {}),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errorMessage = "Unable to generate a response.";

        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) errorMessage = data.error;
        } catch {
          // Ignore invalid error JSON.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("The AI response stream is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data: ")) continue;

            const rawData = line.slice(6);
            if (!rawData) continue;

            let payload: {
              type?: string;
              conversationId?: string;
              delta?: string;
              error?: string;
              credits?: { remaining: number; used: number };
              userMessage?: ChatMessage;
              assistantMessage?: ChatMessage;
              generation?: {
                id: string;
                type: string;
                status: string;
                creditsUsed: number;
                provider?: string;
                model?: string;
                duration?: number;
                aspectRatio?: string;
                videoUrl?: string | null;
              };
            };

            try {
              payload = JSON.parse(rawData);
            } catch {
              continue;
            }

            const isCurrentRun =
              activeGenerationRunIdRef.current === runId &&
              (requestConversationId === null ||
                activeConversationIdRef.current === requestConversationId);

            if (!isCurrentRun) {
              continue;
            }

            if (payload.type === "start") {
              if (payload.conversationId) {
                activeConversationIdRef.current = payload.conversationId;
                setActiveConversationId(payload.conversationId);
                persistConversationInUrl(payload.conversationId);
              }

              if (payload.credits) {
                setCreditsRemaining(payload.credits.remaining);
              }

              if (payload.userMessage) {
                if (temporaryUserId) {
                  setMessages((current) =>
                    current.map((item) =>
                      item.id === temporaryUserId ? payload.userMessage! : item,
                    ),
                  );
                } else if (action === "edit") {
                  setMessages((current) =>
                    current.map((item) =>
                      item.id === payload.userMessage!.id
                        ? payload.userMessage!
                        : item,
                    ),
                  );
                }
              }
            }

            if (payload.type === "delta" && typeof payload.delta === "string") {
              setMessages((current) =>
                current.map((item) =>
                  item.id === temporaryAssistantId
                    ? { ...item, content: item.content + payload.delta }
                    : item,
                ),
              );
            }

            if (payload.type === "done") {
              completed = true;

              if (payload.conversationId) {
                activeConversationIdRef.current = payload.conversationId;
                setActiveConversationId(payload.conversationId);
                persistConversationInUrl(payload.conversationId);
              }

              if (payload.credits) {
                setCreditsRemaining(payload.credits.remaining);
              }

              if (
                payload.generation?.type === "VIDEO" &&
                payload.generation.id
              ) {
                const generationId = payload.generation.id;

                setVideoGenerations((current) => ({
                  ...current,
                  [generationId]: {
                    id: generationId,
                    status: payload.generation!.status,
                    creditsUsed: payload.generation!.creditsUsed,
                    provider: payload.generation!.provider,
                    model: payload.generation!.model,
                    duration: payload.generation!.duration,
                    aspectRatio: payload.generation!.aspectRatio,
                    videoUrl: payload.generation!.videoUrl ?? null,
                  },
                }));

                void pollChatVideoGeneration(generationId);
              }

              if (
                (action === "edit" || action === "regenerate") &&
                payload.conversationId
              ) {
                await loadConversation(payload.conversationId);
              }

              if (
                payload.userMessage &&
                payload.assistantMessage &&
                action !== "edit" &&
                action !== "regenerate"
              ) {
                setMessages((current) => {
                  const targetAssistantId = temporaryAssistantId;

                  const withoutTemporary = current.filter(
                    (item) =>
                      item.id !== temporaryUserId &&
                      item.id !== temporaryAssistantId &&
                      item.id !== targetAssistantId,
                  );

                  const userIndex = withoutTemporary.findIndex(
                    (item) => item.id === payload.userMessage!.id,
                  );

                  if (userIndex >= 0) {
                    return [
                      ...withoutTemporary.slice(0, userIndex + 1),
                      payload.assistantMessage!,
                      ...withoutTemporary.slice(userIndex + 1),
                    ];
                  }

                  return [
                    ...withoutTemporary,
                    payload.userMessage!,
                    payload.assistantMessage!,
                  ];
                });
              }
            }

            if (payload.type === "error") {
              throw new Error(
                payload.error ?? "Unable to generate a response.",
              );
            }
          }
        }
      }

      if (!completed) {
        throw new Error("The AI response ended unexpectedly.");
      }

      if (
        activeGenerationRunIdRef.current !== runId ||
        (requestConversationId !== null &&
          activeConversationIdRef.current !== requestConversationId)
      ) {
        return;
      }

      const conversationsResponse = await fetch(
        projectId
          ? `/api/ai/chat?projectId=${encodeURIComponent(projectId)}`
          : "/api/ai/chat",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (conversationsResponse.ok) {
        const conversationsData =
          (await conversationsResponse.json()) as ConversationsResponse;

        setConversations(conversationsData.conversations);
        setCreditsRemaining(conversationsData.credits.balance);
        window.dispatchEvent(new Event("justdy:chat-updated"));
      }
    } catch (err) {
      const isCurrentRun = activeGenerationRunIdRef.current === runId;

      if (!isCurrentRun) {
        return;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        setError(null);
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong.";

      if (action === "retry" || action === "regenerate" || action === "edit") {
        const failed = {
          action,
          ...(effectiveMessage ? { message: effectiveMessage } : {}),
          ...(activeAttachments.length > 0
            ? {
                attachments: activeAttachments.map(
                  (attachment) => attachment.assetId,
                ),
              }
            : {}),
          ...(userMessageId ? { userMessageId } : {}),
          ...(assistantMessageId ? { assistantMessageId } : {}),
        };

        failedGenerationRef.current = failed;
        setFailedGeneration(failed);
      }

      setError(errorMessage);

      setMessages((current) =>
        current.filter((item) => item.id !== temporaryAssistantId),
      );

      if (action === "send" || action === "edit") {
        setInput(trimmedMessage);
        if (action === "send") {
          setAttachments(activeAttachments);
        }

        requestAnimationFrame(() => {
          resizeComposer();
        });
      }
    } finally {
      if (activeGenerationRunIdRef.current === runId) {
        activeGenerationRunIdRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
        setIsStreaming(false);

        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    }
  }

  async function sendMessage(messageOverride?: string) {
    await runChatAction({
      action: "send",
      message: messageOverride ?? input,
      messageAttachments: attachments,
    });
  }

  async function switchBranch(
    message: ChatMessage,
    direction: "previous" | "next",
  ) {
    const branchCount = message.branchCount ?? 1;
    const branchIndex = message.branchIndex ?? 1;

    if (branchCount <= 1) return;

    const targetIndex =
      direction === "previous" ? branchIndex - 1 : branchIndex + 1;

    if (targetIndex < 1 || targetIndex > branchCount) return;

    if (isLoadingRef.current || switchingBranchMessageId) return;

    setSwitchingBranchMessageId(message.id);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_branch",
          conversationId: activeConversationIdRef.current,
          branchMessageId: await findSiblingMessageId(message, targetIndex),
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to switch conversation branch.");
      }

      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        await loadConversation(conversationId);
        window.dispatchEvent(new Event("justdy:chat-updated"));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to switch conversation branch.",
      );
    } finally {
      setSwitchingBranchMessageId(null);
    }
  }

  async function findSiblingMessageId(
    message: ChatMessage,
    targetIndex: number,
  ): Promise<string> {
    const conversationId = activeConversationIdRef.current;
    if (!conversationId) {
      throw new Error("Unable to determine conversation branch.");
    }

    const params = new URLSearchParams({
      conversationId,
      ...(projectId ? { projectId } : {}),
      branchRole: message.role,
      ...(message.parentMessageId
        ? { branchParentId: message.parentMessageId }
        : { branchRoot: "1" }),
    });

    const response = await fetch(`/api/ai/chat?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json()) as {
      error?: string;
      branches?: Array<{ id: string; index: number }>;
    };

    if (!response.ok || !data.branches) {
      throw new Error(data.error ?? "Unable to load conversation branches.");
    }

    const target = data.branches.find((branch) => branch.index === targetIndex);
    if (!target) {
      throw new Error(
        "The selected conversation branch is no longer available.",
      );
    }

    return target.id;
  }

  async function retryMessage(message: ChatMessage) {
    if (
      message.role !== "USER" ||
      isLoadingRef.current ||
      !activeConversationIdRef.current
    ) {
      return;
    }

    await runChatAction({
      action: "retry",
      userMessageId: message.id,
    });
  }

  async function regenerateMessage(message: ChatMessage) {
    if (
      message.role !== "ASSISTANT" ||
      isLoadingRef.current ||
      !activeConversationIdRef.current
    ) {
      return;
    }

    await runChatAction({
      action: "regenerate",
      assistantMessageId: message.id,
    });
  }

  function beginEditMessage(message: ChatMessage) {
    if (message.role !== "USER" || isLoadingRef.current) return;

    setEditingMessageId(message.id);
    setEditingText(message.content);
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditingText("");
  }

  async function submitEditMessage(message: ChatMessage) {
    if (
      message.role !== "USER" ||
      !activeConversationIdRef.current ||
      !editingText.trim() ||
      isLoadingRef.current
    ) {
      return;
    }

    await runChatAction({
      action: "edit",
      message: editingText,
      userMessageId: message.id,
    });
  }

  function stopGeneration() {
    if (!isLoadingRef.current) return;

    // Invalidate the run before aborting so buffered/late SSE events
    // cannot update the UI after the user presses Stop.
    generationRunIdRef.current += 1;
    activeGenerationRunIdRef.current = null;
    isLoadingRef.current = false;

    setIsLoading(false);
    setIsStreaming(false);
    setError(null);

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }
  async function handleFileSelection(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || isLoadingRef.current) return;

    const remaining = Math.max(0, 3 - attachments.length);
    const files = Array.from(fileList).slice(0, remaining);

    if (files.length === 0) {
      setError("You can attach up to 3 files per message.");
      return;
    }

    setError(null);
    setIsUploadingFile(true);

    try {
      const formData = new FormData();
      for (const file of files) formData.append("files", file);

      const response = await fetch("/api/ai/chat/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        attachments?: ChatAttachment[];
      };

      if (!response.ok || !data.attachments) {
        throw new Error(data.error ?? "Unable to upload the selected file.");
      }

      setAttachments((current) =>
        [...current, ...data.attachments!].slice(0, 3),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload the selected file.",
      );
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(assetId: string) {
    if (isLoadingRef.current) return;
    setAttachments((current) =>
      current.filter((attachment) => attachment.assetId !== assetId),
    );
  }

  /* ==========================================================
     SUBMIT
  ========================================================== */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void sendMessage();
  }

  /* ==========================================================
     KEYBOARD
  ========================================================== */

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      void sendMessage();
    }
  }

  /* ==========================================================
     ARCHIVE
  ========================================================== */

  /* ==========================================================
     COPY
  ========================================================== */

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopiedMessageId(message.id);

      window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 1500);
    } catch {
      // Clipboard unavailable.
    }
  }

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  const displayName = user.name?.trim() || user.email.split("@")[0] || "there";
  const isEmptyState = !activeConversationId && messages.length === 0;

  const composer = (
    <ChatComposer
      input={input}
      setInput={setInput}
      textareaRef={textareaRef}
      resizeComposer={resizeComposer}
      handleSubmit={handleSubmit}
      handleKeyDown={handleKeyDown}
      isLoading={isLoading}
      isStreaming={isStreaming}
      stopGeneration={stopGeneration}
      attachments={attachments}
      isUploadingFile={isUploadingFile}
      fileInputRef={fileInputRef}
      onFilesSelected={(files) => void handleFileSelection(files)}
      onRemoveAttachment={removeAttachment}
    />
  );

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      {activeConversationId && (
        <div className="flex h-11 shrink-0 items-center border-b border-border/50 bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl min-w-0 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <MessageSquare className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {getConversationTitle(activeConversation?.title ?? "")}
                </p>
                {activeConversation?.model && (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {activeConversation.model}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
            MESSAGE AREA
        ==================================================== */}

      <div
        ref={messageScrollRef}
        onScroll={handleMessageScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {!activeConversationId && messages.length === 0 ? (
          <EmptyState
            displayName={displayName}
            projectId={projectId}
            creditsRemaining={creditsRemaining}
            composer={composer}
            onSuggestion={(suggestion) => {
              setInput(suggestion);
              window.requestAnimationFrame(() => {
                textareaRef.current?.focus();
                resizeComposer();
              });
            }}
          />
        ) : isLoadingHistory ? (
          <MessageSkeleton />
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            {hasMoreMessages && (
              <div className="mb-5 flex min-h-6 items-center justify-center">
                {isLoadingOlderMessages ? (
                  <div
                    className="text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    Loading older messages…
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Scroll up to load older messages
                  </div>
                )}
              </div>
            )}

            <div className="space-y-7">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  videoGeneration={
                    message.videoGenerationId
                      ? videoGenerations[message.videoGenerationId]
                      : undefined
                  }
                  copied={copiedMessageId === message.id}
                  onCopy={() => void copyMessage(message)}
                  canEdit={!isLoading && message.role === "USER"}
                  canRetry={
                    !isLoading &&
                    message.role === "USER" &&
                    index === messages.length - 1
                  }
                  canRegenerate={
                    !isLoading &&
                    message.role === "ASSISTANT" &&
                    index === messages.length - 1
                  }
                  editing={editingMessageId === message.id}
                  editingText={editingText}
                  onEdit={() => beginEditMessage(message)}
                  onCancelEdit={cancelEditMessage}
                  onEditingTextChange={setEditingText}
                  onSubmitEdit={() => void submitEditMessage(message)}
                  onRetry={() => void retryMessage(message)}
                  onRegenerate={() => void regenerateMessage(message)}
                  onSwitchBranch={(direction) =>
                    void switchBranch(message, direction)
                  }
                  switchingBranch={switchingBranchMessageId === message.id}
                />
              ))}

              {isStreaming && (
                <div className="flex items-center gap-2.5 pt-1 text-xs text-muted-foreground">
                  <span
                    className="inline-flex items-center gap-1"
                    aria-hidden="true"
                  >
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                  </span>
                  <span>Justdy AI is generating</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomSentinelRef} aria-hidden="true" />

        {isAwayFromBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToLatest("smooth")}
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium shadow-lg transition hover:bg-muted"
            aria-label="Jump to latest message"
          >
            <ArrowUp className="h-3.5 w-3.5 rotate-180" />
            Jump to latest
          </button>
        )}
      </div>

      {/* Error */}

      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words">{error}</p>

            <div className="flex shrink-0 items-center gap-1">
              {failedGeneration && (
                <button
                  type="button"
                  onClick={retryFailedGeneration}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-destructive/10"
                >
                  Try again
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  failedGenerationRef.current = null;
                  setFailedGeneration(null);
                  setError(null);
                }}
                className="rounded-md p-1.5 hover:bg-destructive/10"
                aria-label="Dismiss error"
                title="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!isEmptyState && (
        <div className="w-full shrink-0">
          <div className="mx-auto w-full max-w-4xl px-4 pb-3 sm:px-6 lg:px-8">
            {composer}
          </div>
        </div>
      )}
    </main>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  displayName,
  projectId,
  creditsRemaining,
  composer,
  onSuggestion,
}: {
  displayName: string;
  projectId?: string | null;
  creditsRemaining?: number | null;
  composer: ReactNode;
  onSuggestion: (suggestion: string) => void;
}) {
  const quickActions = [
    {
      title: "Worksheet",
      description: "Create a polished worksheet",
      icon: ClipboardCheck,
      prompt:
        "Create a professional educational worksheet. Ask me for the subject, grade, topic, and number of questions if needed.",
    },
    {
      title: "Lesson",
      description: "Build a complete lesson",
      icon: BookOpen,
      prompt:
        "Help me create a complete lesson plan. Ask me for the subject, grade, topic, duration, and learning objectives if needed.",
    },
    {
      title: "Quiz",
      description: "Generate a quiz or assessment",
      icon: WandSparkles,
      prompt:
        "Create an engaging quiz for my students. Ask me for the subject, grade, topic, difficulty, and number of questions if needed.",
    },
    {
      title: "Video",
      description: "Create an educational video",
      icon: Video,
      prompt:
        "Help me create an educational video. Ask me for the topic, audience, style, and desired duration if needed.",
    },
  ];

  return (
    <div className="min-h-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col justify-center py-8 sm:py-14">
        <div className="text-center">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 text-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground sm:text-[38px]">
              What do you want to create, {displayName}?
            </h1>
          </div>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Create learning materials, explore ideas, analyze files, or get help
            from Justdy AI.
          </p>

          {projectId && (
            <div className="mt-4 flex justify-center">
              <ProjectContextIndicator projectId={projectId} compact />
            </div>
          )}

          {typeof creditsRemaining === "number" && (
            <div className="mt-4 text-[11px] text-muted-foreground">
              {creditsRemaining.toLocaleString()} AI credits available
            </div>
          )}
        </div>

        <div className="mt-8">{composer}</div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Start with a template
            </p>
            <Link
              href="/dashboard"
              className="text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              Explore workspace
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => onSuggestion(action.prompt)}
                  className="group rounded-xl border border-border/80 bg-card/80 p-3.5 text-left transition duration-200 hover:border-border hover:bg-muted/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="mt-3 block text-xs font-semibold text-foreground">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                    {action.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
          <span>Create learning materials</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>Analyze files</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>Generate images & video</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>Get help from AI</span>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/* ============================================================
   CHAT COMPOSER
============================================================ */

function ChatComposer({
  input,
  setInput,
  textareaRef,
  resizeComposer,
  handleSubmit,
  handleKeyDown,
  isLoading,
  isStreaming,
  stopGeneration,
  attachments,
  isUploadingFile,
  fileInputRef,
  onFilesSelected,
  onRemoveAttachment,
}: {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  resizeComposer: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  isStreaming: boolean;
  stopGeneration: () => void;
  attachments: ChatAttachment[];
  isUploadingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveAttachment: (assetId: string) => void;
}) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="relative rounded-[20px] border border-border/90 bg-card shadow-[0_14px_44px_-22px_hsl(var(--foreground)/0.24)] transition-all duration-200 focus-within:border-foreground/25 focus-within:shadow-[0_18px_50px_-22px_hsl(var(--foreground)/0.3)] focus-within:ring-4 focus-within:ring-foreground/5">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-border px-4 pt-3 pb-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.assetId}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-muted/50 px-2.5 py-2 text-xs"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="max-w-[220px] truncate font-medium">
                  {attachment.name}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.assetId)}
                  className="rounded-md p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                  aria-label={`Remove ${attachment.name}`}
                  title={`Remove ${attachment.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            resizeComposer();
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          maxLength={12000}
          placeholder="Ask Justdy AI to create something..."
          className="min-h-[76px] max-h-48 w-full resize-none overflow-y-hidden bg-transparent px-5 pb-14 pt-[18px] text-[15px] leading-6 outline-none placeholder:text-muted-foreground/65 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.txt,.md,.csv,.json,.rtf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,application/pdf,text/plain,text/markdown,text/csv,application/json,image/*"
          onChange={(event) => onFilesSelected(event.target.files)}
        />

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploadingFile || attachments.length >= 3}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Attach a file"
              title={
                attachments.length >= 3 ? "Maximum 3 files" : "Attach a file"
              }
            >
              {isUploadingFile ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
            </button>

            <div className="min-w-0 pl-1 text-[11px] text-muted-foreground">
              {isStreaming ? (
                <span>Justdy AI is generating…</span>
              ) : isUploadingFile ? (
                <span>Uploading file…</span>
              ) : (
                <span>
                  <span className="hidden sm:inline">
                    Attach a file to analyze · Enter to send · Shift + Enter for
                    a new line
                  </span>
                  <span className="sm:hidden">Attach · Enter to send</span>
                </span>
              )}
            </div>
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-3 text-xs font-medium text-background transition hover:opacity-90"
              aria-label="Stop generating"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                (!input.trim() && attachments.length === 0) ||
                isLoading ||
                isUploadingFile
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Send message"
              title="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">
        Justdy AI can make mistakes. Check important information.
      </p>
    </form>
  );
}

/* ============================================================
   CONVERSATION ITEM
============================================================ */

/* ============================================================
   MESSAGE BUBBLE
============================================================ */

function MessageBubble({
  message,
  videoGeneration,
  copied,
  onCopy,
  canEdit,
  canRetry,
  canRegenerate,
  editing,
  editingText,
  onEdit,
  onCancelEdit,
  onEditingTextChange,
  onSubmitEdit,
  onRetry,
  onRegenerate,
  onSwitchBranch,
  switchingBranch,
}: {
  message: ChatMessage;
  videoGeneration?: ChatVideoGeneration;
  copied: boolean;
  onCopy: () => void;
  canEdit: boolean;
  canRetry: boolean;
  canRegenerate: boolean;
  editing: boolean;
  editingText: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onEditingTextChange: (value: string) => void;
  onSubmitEdit: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onSwitchBranch: (direction: "previous" | "next") => void;
  switchingBranch: boolean;
}) {
  const isUser = message.role === "USER";

  if (editing && isUser) {
    return (
      <div className="group flex justify-end">
        <div className="w-full max-w-[min(42rem,88%)]">
          <div className="mb-2 flex items-center justify-end gap-2 px-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              You
            </span>
            {formatMessageTime(message.createdAt) && (
              <span className="text-[10px] text-muted-foreground/70">
                {formatMessageTime(message.createdAt)}
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl rounded-br-md border border-border bg-muted/60 shadow-sm ring-1 ring-foreground/[0.03]">
            <textarea
              autoFocus
              value={editingText}
              onChange={(event) => onEditingTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit();
                }

                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmitEdit();
                }
              }}
              maxLength={12000}
              rows={Math.min(8, Math.max(3, editingText.split("\n").length))}
              className="w-full resize-none bg-transparent px-4 py-3.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            />

            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2.5">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmitEdit}
                disabled={!editingText.trim()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isUser ? "group flex justify-end" : "group flex justify-start"}
    >
      <div
        className={[
          "min-w-0",
          isUser ? "w-full max-w-[min(42rem,88%)]" : "w-full max-w-3xl",
        ].join(" ")}
      >
        <div
          className={[
            "mb-2 flex items-center gap-2 px-1",
            isUser ? "justify-end" : "justify-start",
          ].join(" ")}
        >
          <span
            className={[
              "inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-tight",
              isUser ? "text-muted-foreground" : "text-foreground",
            ].join(" ")}
          >
            {!isUser && (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
            {isUser ? "You" : "Justdy AI"}
          </span>

          {formatMessageTime(message.createdAt) && (
            <span className="text-[10px] text-muted-foreground/70">
              {formatMessageTime(message.createdAt)}
            </span>
          )}
        </div>

        {isUser ? (
          <>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap justify-end gap-2">
                {message.attachments.map((attachment) => (
                  <div
                    key={attachment.assetId}
                    className="inline-flex max-w-[min(24rem,88%)] items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-foreground"
                  >
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">
                      {attachment.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatFileSize(attachment.size)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <div className="max-w-full rounded-2xl rounded-br-md border border-border/70 bg-muted/80 px-4 py-3 text-[14px] leading-6 text-foreground shadow-sm">
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="min-w-0 text-foreground">
            <AIResponseRenderer content={message.content} />

            {message.metadata?.type === "WORKSHEET" &&
              message.metadata.worksheet && (
                <ChatWorksheetPreview
                  worksheet={message.metadata.worksheet}
                  generationId={message.generationId}
                />
              )}

            {message.metadata?.type === "IMAGE" && message.metadata.image && (
              <ChatImagePreview image={message.metadata.image} />
            )}

            {message.videoGenerationId && (
              <ChatVideoPlayer
                generationId={message.videoGenerationId}
                generation={videoGeneration}
              />
            )}
          </div>
        )}

        {message.branchCount && message.branchCount > 1 && (
          <div
            className={[
              "mt-3 flex w-fit items-center gap-1 rounded-xl border border-border bg-card px-1 py-0.5 shadow-sm",
              isUser ? "ml-auto" : "mr-auto",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onSwitchBranch("previous")}
              disabled={switchingBranch || message.branchIndex === 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="Previous branch"
              title="Previous branch"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-10 px-1 text-center text-[11px] font-medium text-muted-foreground">
              {message.branchIndex}/{message.branchCount}
            </span>
            <button
              type="button"
              onClick={() => onSwitchBranch("next")}
              disabled={
                switchingBranch || message.branchIndex === message.branchCount
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next branch"
              title="Next branch"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div
          className={[
            "mt-2 flex flex-wrap items-center gap-1 transition-opacity",
            isUser ? "justify-end" : "justify-start",
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          ].join(" ")}
        >
          {!isUser && (
            <>
              <MessageActionButton
                label={copied ? "Copied" : "Copy"}
                onClick={onCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </MessageActionButton>

              {canRegenerate && (
                <MessageActionButton label="Regenerate" onClick={onRegenerate}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </MessageActionButton>
              )}
            </>
          )}

          {isUser && canEdit && (
            <MessageActionButton label="Edit" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </MessageActionButton>
          )}

          {isUser && canRetry && (
            <MessageActionButton label="Retry" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" />
            </MessageActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatImagePreview({
  image,
}: {
  image: NonNullable<NonNullable<ChatMessage["metadata"]>["image"]>;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadImage() {
    if (!image.url || downloading) {
      return;
    }

    setDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(image.url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to download the generated image.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `justdy-image-${image.assetId}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      try {
        const anchor = document.createElement("a");
        anchor.href = image.url;
        anchor.download = `justdy-image-${image.assetId}.png`;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch {
        setDownloadError(
          error instanceof Error
            ? error.message
            : "Unable to download the generated image.",
        );
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="bg-muted/20 p-2 sm:p-3">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt || "Generated image"}
            className="block h-auto max-h-[720px] w-full object-contain"
            loading="lazy"
          />
        </div>
      </div>

      <div className="border-t border-border px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              Generated image
            </p>

            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {image.size} · {image.quality} · {image.model}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void downloadImage()}
            disabled={downloading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {downloading ? "Downloading…" : "Download image"}
          </button>
        </div>

        {downloadError && (
          <p className="mt-2 text-[11px] text-destructive">{downloadError}</p>
        )}
      </div>
    </div>
  );
}

function ChatWorksheetPreview({
  worksheet,
  generationId,
}: {
  worksheet: WorksheetDocument;
  generationId?: string | null;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<
    "worksheet" | "answer-key" | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await fetch("/api/ai/worksheet/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ worksheet }),
        });

        if (!response.ok) {
          let message = "Unable to load worksheet preview.";
          try {
            const data = (await response.json()) as { error?: string };
            if (data.error) message = data.error;
          } catch {
            // Ignore non-JSON error responses.
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setPreviewUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(
            error instanceof Error
              ? error.message
              : "Unable to load worksheet preview.",
          );
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [worksheet]);

  function editWorksheet() {
    if (!generationId) {
      setPreviewError(
        "This worksheet cannot be opened in the editor because its generation ID is missing.",
      );
      return;
    }

    const params = new URLSearchParams({
      generationId,
    });

    window.location.href = `/create/worksheet/editor?${params.toString()}`;
  }

  async function download(type: "worksheet" | "answer-key") {
    if (downloading) return;

    setDownloading(type);

    try {
      const response = await fetch("/api/ai/worksheet/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ worksheet, type }),
      });

      if (!response.ok) {
        let message = "Unable to download worksheet.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Ignore non-JSON error responses.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        type === "answer-key"
          ? `${
              worksheet.title
                .replace(/[^a-zA-Z0-9-_ ]/g, "")
                .trim()
                .replace(/\s+/g, "-") || "worksheet"
            }-answer-key.pdf`
          : `${
              worksheet.title
                .replace(/[^a-zA-Z0-9-_ ]/g, "")
                .trim()
                .replace(/\s+/g, "-") || "worksheet"
            }.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to download worksheet.",
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mt-4 max-w-3xl overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{worksheet.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {worksheet.subject} · {worksheet.questions.length} questions
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          Worksheet
        </span>
      </div>

      <div className="bg-muted/40 p-3 sm:p-4">
        {previewLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border bg-background">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing worksheet preview…
            </div>
          </div>
        ) : previewUrl ? (
          <iframe
            title={`${worksheet.title} preview`}
            src={previewUrl}
            className="h-[min(78vh,900px)] min-h-[420px] w-full rounded-xl border border-border bg-background"
          />
        ) : (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-destructive/20 bg-background p-6 text-center">
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              {previewError ?? "The worksheet preview could not be loaded."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3">
        {generationId && (
          <button
            type="button"
            onClick={editWorksheet}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit worksheet
          </button>
        )}

        <button
          type="button"
          onClick={() => void download("worksheet")}
          disabled={downloading !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading === "worksheet" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download worksheet
        </button>

        <button
          type="button"
          onClick={() => void download("answer-key")}
          disabled={downloading !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading === "answer-key" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download answer key
        </button>
      </div>
    </div>
  );
}

function ChatVideoPlayer({
  generationId,
  generation,
}: {
  generationId: string;
  generation?: ChatVideoGeneration;
}) {
  const status = generation?.status;

  if (status === "FAILED" || status === "CANCELLED") {
    return (
      <div className="mt-4 max-w-2xl rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Video generation failed</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {generation?.errorMessage ?? "Justdy AI could not finish this video."}
        </p>
      </div>
    );
  }

  if (status !== "COMPLETED") {
    return (
      <div className="mt-4 flex max-w-2xl items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
        <div>
          <p className="text-sm font-medium">Generating your video…</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This can take a few minutes. You can keep using the chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 max-w-3xl overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
      <video
        className="block h-auto max-h-[70vh] w-full"
        controls
        playsInline
        preload="metadata"
        src={`/api/ai/video/${encodeURIComponent(generationId)}/content`}
      >
        Your browser does not support video playback.
      </video>
      <div className="flex items-center justify-between gap-3 bg-background px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">Video ready</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {generation?.model ?? "Sora"}
            {generation?.duration ? ` · ${generation.duration}s` : ""}
            {generation?.aspectRatio ? ` · ${generation.aspectRatio}` : ""}
          </p>
        </div>
        {typeof generation?.creditsUsed === "number" && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {generation.creditsUsed} credits
          </span>
        )}
      </div>
    </div>
  );
}

function MessageActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

/* ============================================================
   AI RESPONSE MARKDOWN RENDERER
============================================================ */

function AIResponseRenderer({ content }: { content: string }) {
  return (
    <div className="break-words text-[14px] leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 text-xl font-semibold tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-lg font-semibold tracking-tight">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-base font-semibold">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="mb-4 whitespace-pre-wrap last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-5 list-disc space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-5 list-decimal space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-border pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium underline underline-offset-2 hover:opacity-70"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del>{children}</del>,
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-"));

            if (isBlock) {
              return (
                <code className="block min-w-0 font-mono text-[13px] leading-6">
                  {children}
                </code>
              );
            }

            return (
              <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="my-5 w-full overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border last:border-b-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2.5 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2.5 align-top">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    const code = extractCodeText(children);

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-sm">
      <div className="flex items-center justify-end border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-background hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="overflow-x-auto p-4">{children}</pre>
    </div>
  );
}

function extractCodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractCodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractCodeText(node.props.children);
  }

  return "";
}

function MessageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex gap-4">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />

          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />

            <div className="h-3 w-full max-w-2xl animate-pulse rounded bg-muted" />

            <div className="h-3 w-3/4 max-w-xl animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

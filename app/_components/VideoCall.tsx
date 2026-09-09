"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  LayoutTemplate,
  MonitorUp,
  CircleDot,
  StopCircle,
} from "lucide-react";

// --- Types ---
export type TutoringSignal = {
  type: string;
  data?: unknown;
};

type VonageConnection = {
  connectionId?: string;
};

interface VideoCallProps {
  sessionId: string;
  token: string;
  role: "educator" | "student";
  onSignal?: (signal: TutoringSignal & { connectionId: string | null }) => void;
  onParticipantChange?: (participant: {
    connectionId: string;
    joined: boolean;
  }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onSignalReady?: (sendSignal: (type: string, data?: unknown) => void) => void;
  onEndSession?: () => Promise<void> | void;
}

interface ControlButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

export default function VideoCall({
  sessionId,
  token,
  role,
  onSignal,
  onParticipantChange,
  onConnected,
  onDisconnected,
  onSignalReady,
  onEndSession,
}: VideoCallProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLessonMode, setIsLessonMode] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // Replace 'any' with specific Vonage types
  const sessionRef = useRef<OT.Session | null>(null);
  const publisherRef = useRef<OT.Publisher | null>(null);
  const screenPublisherRef = useRef<OT.Publisher | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioEnabledRef = useRef(isAudioEnabled);
  const videoEnabledRef = useRef(isVideoEnabled);
  const router = useRouter();
  const appId = process.env.NEXT_PUBLIC_VONAGE_APPLICATION_ID;
  const remoteParticipantLabel = role === "educator" ? "Customer" : "Tutor";

  const sendSignal = useCallback((type: string, data?: unknown) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const payload = JSON.stringify({ type, data });

    (
      currentSession as OT.Session & {
        signal: (
          signal?: { type?: string; data?: string },
          callback?: (error?: unknown) => void,
        ) => void;
      }
    ).signal(
      {
        type: "justdy",
        data: payload,
      },
      (error: unknown) => {
        if (error) {
          console.error("Vonage signal error:", error);
        }
      },
    );
  }, []);

  useEffect(() => {
    audioEnabledRef.current = isAudioEnabled;
    videoEnabledRef.current = isVideoEnabled;
  }, [isAudioEnabled, isVideoEnabled]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
  };

  const initializeSession = useCallback(() => {
    // window.OT is now recognized thanks to the 'declare global' above
    if (
      typeof window === "undefined" ||
      !window.OT ||
      !appId ||
      sessionRef.current
    )
      return;

    try {
      const OT = window.OT;
      const session = OT.initSession(appId, sessionId);
      sessionRef.current = session;

      session.on("streamCreated", (event) => {
        // We cast the event to includes the stream property
        // Using the library's base event type + the stream requirement
        const streamEvent = event as OT.OTEvent & { stream: OT.Stream };

        if (sessionRef.current && streamEvent.stream) {
          session.subscribe(streamEvent.stream, "subscriber-container", {
            insertMode: "append",
            width: "100%",
            height: "100%",
            style: { buttonDisplayMode: "off" },
          });
        }
      });

      session.on("connectionCreated", (event) => {
        const connectionEvent = event as OT.OTEvent & {
          connection: VonageConnection;
        };
        const connectionId = connectionEvent.connection?.connectionId;
        if (connectionId) {
          onParticipantChange?.({ connectionId, joined: true });
        }
      });

      session.on("connectionDestroyed", (event) => {
        const connectionEvent = event as OT.OTEvent & {
          connection: VonageConnection;
        };
        const connectionId = connectionEvent.connection?.connectionId;
        if (connectionId) {
          onParticipantChange?.({ connectionId, joined: false });
        }
      });

      session.on("signal", (event) => {
        const signalEvent = event as OT.OTEvent & {
          data?: string;
          from?: VonageConnection;
        };

        if (!signalEvent.data) return;

        try {
          const parsed = JSON.parse(signalEvent.data) as {
            type?: unknown;
            data?: unknown;
          };

          if (typeof parsed.type !== "string") return;

          onSignal?.({
            type: parsed.type,
            data: parsed.data,
            connectionId: signalEvent.from?.connectionId ?? null,
          });
        } catch (error) {
          console.error("Failed to parse tutoring signal:", error);
        }
      });

      session.on("sessionConnected", () => {
        setIsConnected(true);
        onConnected?.();
        onSignalReady?.(sendSignal);

        publisherRef.current = OT.initPublisher("publisher-container", {
          insertMode: "replace",
          width: "100%",
          height: "100%",
          publishAudio: audioEnabledRef.current,
          publishVideo: videoEnabledRef.current,
          style: { buttonDisplayMode: "off" },
        });

        if (publisherRef.current) {
          session.publish(publisherRef.current);
        }
      });

      session.on("sessionDisconnected", () => {
        setIsConnected(false);
        onDisconnected?.();
      });

      session.connect(token, (err: unknown) => {
        if (err) {
          console.error("Vonage connection failed:", err);
          toast.error("Connection failed");
        }
      });
    } catch (error) {
      console.error("SDK Error:", error);
    }
  }, [
    appId,
    sessionId,
    token,
    onConnected,
    onDisconnected,
    onParticipantChange,
    onSignal,
    onSignalReady,
    sendSignal,
  ]);

  useEffect(() => {
    if (publisherRef.current) publisherRef.current.publishAudio(isAudioEnabled);
  }, [isAudioEnabled]);

  useEffect(() => {
    if (publisherRef.current) publisherRef.current.publishVideo(isVideoEnabled);
  }, [isVideoEnabled]);

  const toggleScreenShare = () => {
    if (typeof window === "undefined" || !window.OT) return;
    const OT = window.OT;

    if (!isScreenSharing) {
      screenPublisherRef.current = OT.initPublisher(
        "publisher-container",
        {
          videoSource: "screen",
          insertMode: "append",
          width: "100%",
          height: "100%",
        },
        (error: unknown) => {
          if (error) {
            toast.error("Screen sharing not supported or denied");
          } else if (sessionRef.current && screenPublisherRef.current) {
            sessionRef.current.publish(screenPublisherRef.current);
            setIsScreenSharing(true);
          }
        },
      );

      screenPublisherRef.current.on("streamDestroyed", () => {
        setIsScreenSharing(false);
      });
    } else {
      if (sessionRef.current && screenPublisherRef.current) {
        sessionRef.current.unpublish(screenPublisherRef.current);
        screenPublisherRef.current.destroy();
        setIsScreenSharing(false);
      }
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast.info(!isRecording ? "Recording started" : "Recording saved");
  };

  useEffect(() => {
    if (scriptLoaded && appId && sessionId && token) {
      initializeSession();
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }

      const session = sessionRef.current;
      const publisher = publisherRef.current;
      const screenPublisher = screenPublisherRef.current;

      if (session && screenPublisher) {
        try {
          session.unpublish(screenPublisher);
        } catch (error) {
          console.debug(
            "Unable to unpublish screen share during cleanup:",
            error,
          );
        }
      }

      try {
        screenPublisher?.destroy();
      } catch (error) {
        console.debug(
          "Unable to destroy screen publisher during cleanup:",
          error,
        );
      }

      try {
        publisher?.destroy();
      } catch (error) {
        console.debug("Unable to destroy publisher during cleanup:", error);
      }

      try {
        session?.disconnect();
      } catch (error) {
        console.debug(
          "Unable to disconnect Vonage session during cleanup:",
          error,
        );
      }

      sessionRef.current = null;
      publisherRef.current = null;
      screenPublisherRef.current = null;
    };
  }, [scriptLoaded, appId, sessionId, token, initializeSession]);

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-0 bg-[#020617] text-slate-100 overflow-hidden font-sans"
      onMouseMove={handleMouseMove}
    >
      <Script
        src="https://unpkg.com/@vonage/client-sdk-video@2.28.2/dist/js/opentok.js"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* Loading State */}
      {!isConnected && (
        <div className="absolute inset-0 z-100 flex flex-col items-center justify-center bg-slate-950">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl bg-emerald-500/20 animate-pulse" />
            <Loader2 className="size-10 text-emerald-500 animate-spin relative" />
          </div>
          <p className="mt-6 text-slate-400 font-light tracking-widest uppercase text-xs">
            Establishing Secure Connection
          </p>
        </div>
      )}

      {/* Video Canvas */}
      <div className="relative flex h-full w-full">
        {/* PUBLISHER (Self) - Takes 100% in Lesson, 50% in Grid */}
        <div
          className={`relative bg-slate-950 transition-all duration-700 ease-in-out ${
            isLessonMode ? "w-full" : "w-1/2 border-r border-white/10"
          }`}
        >
          <div id="publisher-container" className="absolute inset-0 z-10" />
          <div className="absolute inset-0 z-20 bg-linear-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        </div>

        {/* SUBSCRIBER (Remote) - Draggable PiP in Lesson, 50% in Grid */}
        <motion.div
          layout
          drag={isLessonMode}
          dragConstraints={constraintsRef}
          dragMomentum={false}
          className={`bg-slate-900 border-white/5 shadow-2xl overflow-hidden transition-all duration-500 ease-in-out ${
            isLessonMode
              ? "absolute top-8 right-8 z-40 w-80 aspect-video rounded-2xl border backdrop-blur-xl cursor-grab active:cursor-grabbing"
              : "w-1/2 relative"
          }`}
        >
          <div id="subscriber-container" className="absolute inset-0 z-10" />
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
              {remoteParticipantLabel}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Modern Control Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 100, x: "-50%", opacity: 0 }}
            className="absolute bottom-10 left-1/2 z-60 w-full max-w-2xl px-6"
          >
            <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 p-4 rounded-3xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2">
                <ControlButton
                  active={isAudioEnabled}
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  icon={
                    isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />
                  }
                  danger={!isAudioEnabled}
                />
                <ControlButton
                  active={isVideoEnabled}
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  icon={
                    isVideoEnabled ? (
                      <Video size={20} />
                    ) : (
                      <VideoOff size={20} />
                    )
                  }
                  danger={!isVideoEnabled}
                />
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                <ActionButton
                  label="Share"
                  icon={<MonitorUp size={18} />}
                  active={isScreenSharing}
                  onClick={toggleScreenShare}
                />
                <ActionButton
                  label={isRecording ? "Stop" : "Record"}
                  icon={
                    isRecording ? (
                      <StopCircle size={18} className="text-red-500" />
                    ) : (
                      <CircleDot size={18} />
                    )
                  }
                  active={isRecording}
                  onClick={toggleRecording}
                />
                <div className="w-px h-4 bg-white/10 mx-1" />
                <ActionButton
                  label={isLessonMode ? "Grid" : "Lesson"}
                  icon={<LayoutTemplate size={18} />}
                  onClick={() => setIsLessonMode(!isLessonMode)}
                />
              </div>

              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    await onEndSession?.();
                  } catch (error) {
                    console.error("Failed to end tutoring session:", error);
                  } finally {
                    sessionRef.current?.disconnect();
                    router.push("/tutoring/sessions");
                  }
                }}
                className="rounded-2xl h-12 w-14 bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/20 border-t border-white/20"
              >
                <PhoneOff size={20} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ControlButton({ active, onClick, icon, danger }: ControlButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`rounded-2xl size-12 transition-all duration-300 ${
        danger
          ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
          : "text-slate-300 hover:bg-white/10"
      } ${active && !danger ? "bg-white/5 text-white" : ""}`}
    >
      {icon}
    </Button>
  );
}

function ActionButton({ label, icon, active, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 hover:bg-white/10 ${
        active ? "text-emerald-400" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">
        {label}
      </span>
    </button>
  );
}

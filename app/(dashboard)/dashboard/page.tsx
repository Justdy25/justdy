import { redirect } from "next/navigation";

import AIChatWorkspace from "../chat/AIChatWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    projectId?: string;
    prompt?: string;
    conversationId?: string;
    new?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const projectId =
    typeof params.projectId === "string"
      ? params.projectId.trim() || null
      : null;

  const initialPrompt = typeof params.prompt === "string" ? params.prompt : "";

  const initialConversationId =
    typeof params.conversationId === "string"
      ? params.conversationId.trim() || null
      : null;

  const newChatToken = typeof params.new === "string" ? params.new : "";

  return (
    <AIChatWorkspace
      user={{
        id: user.id,
        name: user.name ?? "",
        email: user.email,
      }}
      initialPrompt={initialPrompt}
      projectId={projectId}
      initialConversationId={initialConversationId}
      startNewChatOnLoad={true}
      newChatToken={newChatToken}
    />
  );
}

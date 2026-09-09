import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import WorksheetEditor from "./WorksheetEditor";

export const dynamic = "force-dynamic";

interface WorksheetEditorPageProps {
  searchParams: Promise<{
    generationId?: string;
  }>;
}

export default async function WorksheetEditorPage({
  searchParams,
}: WorksheetEditorPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const generationId =
    typeof params.generationId === "string" ? params.generationId.trim() : "";

  if (!generationId) {
    redirect("/create/worksheet");
  }

  return <WorksheetEditor generationId={generationId} />;
}

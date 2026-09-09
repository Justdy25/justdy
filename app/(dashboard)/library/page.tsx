import { redirect } from "next/navigation";

import ArtifactLibrary from "@/app/_components/ai/ArtifactLibrary";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

type LibraryPageProps = {
  searchParams: Promise<{ projectId?: string }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const projectId = params.projectId?.trim() || null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
        <ArtifactLibrary initialProjectId={projectId} />
      </div>
    </main>
  );
}

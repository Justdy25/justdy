import AIVideoStudio from "@/app/_components/AIVideoStudio";

export default async function AIVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  return <AIVideoStudio projectId={params.projectId ?? null} />;
}

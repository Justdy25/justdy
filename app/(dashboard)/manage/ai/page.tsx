import { requireManager } from "@/app/actions/require-manager";
import JustdyAIStudio from "@/app/_components/JustdyAIStudio";

export default async function JustdyAIPage() {
  await requireManager();

  return <JustdyAIStudio />;
}

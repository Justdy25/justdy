import { Suspense } from "react";

import PromptStudioPage from "@/app/_components/PromptStudioPage";

export default function AudioCreatePage() {
  return (
    <Suspense fallback={null}>
      <PromptStudioPage kind="audio" />
    </Suspense>
  );
}

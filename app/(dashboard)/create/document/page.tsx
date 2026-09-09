import { Suspense } from "react";

import PromptStudioPage from "@/app/_components/PromptStudioPage";

export default function DocumentCreatePage() {
  return (
    <Suspense fallback={null}>
      <PromptStudioPage kind="document" />
    </Suspense>
  );
}

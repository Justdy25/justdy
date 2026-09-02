import WorksheetsLibrary from "@/app/_components/ai/worksheet/WorksheetsLibrary";
import WorksheetStudio from "@/app/_components/ai/worksheet/WorksheetStudio";

import { GetWorksheets } from "@/app/actions/ai/get-worksheets";

interface WorksheetsPageProps {
  searchParams: Promise<{
    projectId?: string;
    new?: string;
  }>;
}

export default async function WorksheetsPage({
  searchParams,
}: WorksheetsPageProps) {
  const params = await searchParams;

  const projectId = params.projectId?.trim() || null;
  const isNewWorksheet = params.new === "1";

  /*
   * ============================================================
   * LOAD WORKSHEETS
   * ============================================================
   *
   * We load the existing worksheets because:
   *
   * 1. The library needs them.
   * 2. The Studio needs a subject list.
   *
   * The actual saved worksheet is loaded by WorksheetStudio
   * through GetWorksheet(projectId).
   */

  const result = await GetWorksheets();

  /*
   * ============================================================
   * STUDIO MODE
   * ============================================================
   *
   * There are two ways to enter the Studio:
   *
   * 1. ?projectId=...  -> edit an existing worksheet
   * 2. ?new=1          -> create a new worksheet
   */

  if (projectId || isNewWorksheet) {
    /*
     * Build the subject list from existing worksheets.
     *
     * This avoids introducing another server action just to
     * populate the subject selector.
     */

    const subjectMap = new Map<
      string,
      {
        id: string;
        name: string;
      }
    >();

    if (result.success) {
      for (const worksheet of result.worksheets) {
        const name = worksheet.subject?.trim();

        if (!name) {
          continue;
        }

        const key = name.toLowerCase();

        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            id: key,
            name,
          });
        }
      }
    }

    /*
     * Always provide at least one subject so the Studio
     * remains usable even when there are no saved worksheets.
     */

    if (subjectMap.size === 0) {
      subjectMap.set("mathematics", {
        id: "mathematics",
        name: "Mathematics",
      });
    }

    const subjects = Array.from(subjectMap.values());

    return <WorksheetStudio subjects={subjects} />;
  }

  /*
   * ============================================================
   * LIBRARY MODE
   * ============================================================
   *
   * No projectId and no ?new=1 means the user is viewing
   * the worksheet library.
   */

  return (
    <WorksheetsLibrary
      initialWorksheets={result.success ? result.worksheets : []}
      initialError={result.success ? null : result.error}
    />
  );
}

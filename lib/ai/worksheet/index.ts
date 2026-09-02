import { generateWorksheet } from "./generator";
import type { WorksheetDocument } from "./schema";

export async function createWorksheet(
  input: Parameters<typeof generateWorksheet>[0],
): Promise<WorksheetDocument> {
  const worksheet = await generateWorksheet(input);

  return worksheet;
}

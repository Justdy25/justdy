"use server";

import { UTApi } from "uploadthing/server";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

const utapi = new UTApi();

export async function deleteUTFile(fileKey: string) {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (!fileKey || !fileKey.trim()) {
    return {
      success: false,
    };
  }

  try {
    await utapi.deleteFiles(fileKey);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to delete file:", error);

    return {
      success: false,
    };
  }
}

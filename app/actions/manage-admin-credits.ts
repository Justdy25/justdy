"use server";

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { AddUserCredits } from "./manage-ai-video-credits";

export async function GrantTestCredits(amount: number) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in.",
    };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      success: false,
      error: "Invalid credit amount.",
    };
  }

  try {
    await AddUserCredits({
      userId: session.user.id,
      amount,
      type: "GRANT",
      description: "Development test credits",
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("GrantTestCredits error:", error);

    return {
      success: false,
      error: "Unable to grant credits.",
    };
  }
}

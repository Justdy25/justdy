import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addCreditsInTransaction } from "@/lib/ai/credits";

export async function POST(request: Request) {
  /*
   * ----------------------------------------------------------
   * DEVELOPMENT ONLY
   * ----------------------------------------------------------
   */

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Development credit tools are disabled in production.",
      },
      { status: 403 },
    );
  }

  try {
    /*
     * ----------------------------------------------------------
     * AUTHENTICATED USER
     * ----------------------------------------------------------
     */

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        { status: 401 },
      );
    }

    /*
     * ----------------------------------------------------------
     * REQUEST
     * ----------------------------------------------------------
     */

    const body = await request.json();

    const amount =
      typeof body.amount === "number" ? body.amount : Number(body.amount);

    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "amount must be a positive integer.",
        },
        { status: 400 },
      );
    }

    /*
     * ----------------------------------------------------------
     * GRANT CREDITS
     * ----------------------------------------------------------
     *
     * The user ID always comes from the authenticated session.
     * It cannot be supplied by the browser.
     */

    const result = await prisma.$transaction(async (tx) => {
      return addCreditsInTransaction(tx, {
        userId: session.user.id,
        amount,
        description: "Development/test AI credits",
      });
    });

    return NextResponse.json({
      success: true,
      added: amount,
      balance: result.balance,
    });
  } catch (error) {
    console.error("Development AI credit grant failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to grant development AI credits.",
      },
      { status: 500 },
    );
  }
}

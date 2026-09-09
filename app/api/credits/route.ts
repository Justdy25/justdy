import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const creditAccount = await prisma.userCredit.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        balance: true,
      },
    });

    return NextResponse.json({
      balance: creditAccount?.balance ?? 0,
    });
  } catch (error) {
    console.error("[Credits API] Failed to load credit balance:", error);

    return NextResponse.json(
      {
        error: "Unable to load credit balance.",
      },
      {
        status: 500,
      },
    );
  }
}

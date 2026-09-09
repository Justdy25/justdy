import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tutors = await prisma.user.findMany({
      where: {
        facilitatorProfile: {
          is: {
            verificationStatus: "Verified",
          },
        },
        tutoringSlots: {
          some: {
            status: "Available",
            startTime: {
              gte: new Date(),
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        facilitatorProfile: {
          select: {
            specialty: true,
            experience: true,
            description: true,
            verificationStatus: true,
          },
        },
        tutoringSlots: {
          where: {
            status: "Available",
            startTime: {
              gte: new Date(),
            },
          },
          orderBy: {
            startTime: "asc",
          },
          take: 1,
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      tutors,
    });
  } catch (error) {
    console.error("Failed to load tutoring tutors:", error);

    return NextResponse.json(
      {
        error: "Failed to load tutors.",
      },
      {
        status: 500,
      },
    );
  }
}

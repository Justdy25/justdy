import prisma from "@/lib/prisma";

export async function getAvailableTutoringSlots({
  tutorId,
  from,
  to,
}: {
  tutorId: string;
  from: Date;
  to: Date;
}) {
  return prisma.tutoringSlot.findMany({
    where: {
      tutorId,
      status: "Available",
      startTime: {
        gte: from,
        lt: to,
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });
}

export async function getTutoringSlotForBooking(slotId: string) {
  return prisma.tutoringSlot.findFirst({
    where: {
      id: slotId,
      status: "Available",
    },
    include: {
      tutor: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          facilitatorProfile: {
            select: {
              specialty: true,
              experience: true,
              description: true,
              verificationStatus: true,
            },
          },
        },
      },
    },
  });
}

export async function getVerifiedTutor(tutorId: string) {
  return prisma.user.findFirst({
    where: {
      id: tutorId,
      facilitatorProfile: {
        is: {
          verificationStatus: "Verified",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      facilitatorProfile: {
        select: {
          specialty: true,
          experience: true,
          description: true,
          verificationStatus: true,
        },
      },
    },
  });
}

export async function createTutoringSlot({
  tutorId,
  startTime,
  endTime,
}: {
  tutorId: string;
  startTime: Date;
  endTime: Date;
}) {
  if (startTime >= endTime) {
    throw new Error("Slot start time must be before the end time.");
  }

  const tutor = await getVerifiedTutor(tutorId);

  if (!tutor) {
    throw new Error("Tutor is not verified or does not exist.");
  }

  if (startTime <= new Date()) {
    throw new Error("Tutoring slots must be scheduled in the future.");
  }

  /*
   * Prevent overlapping slots for the same tutor.
   *
   * We check both directions:
   *
   * existing.start < requested.end
   * AND
   * existing.end > requested.start
   */
  const overlappingSlot = await prisma.tutoringSlot.findFirst({
    where: {
      tutorId,
      status: {
        not: "Blocked",
      },
      startTime: {
        lt: endTime,
      },
      endTime: {
        gt: startTime,
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingSlot) {
    throw new Error("This tutoring slot overlaps an existing slot.");
  }

  return prisma.tutoringSlot.create({
    data: {
      tutorId,
      startTime,
      endTime,
      status: "Available",
    },
  });
}

export async function blockTutoringSlot({
  tutorId,
  slotId,
}: {
  tutorId: string;
  slotId: string;
}) {
  const slot = await prisma.tutoringSlot.findFirst({
    where: {
      id: slotId,
      tutorId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!slot) {
    throw new Error("Tutoring slot not found.");
  }

  if (slot.status === "Booked") {
    throw new Error("A booked tutoring slot cannot be blocked.");
  }

  return prisma.tutoringSlot.update({
    where: {
      id: slot.id,
    },
    data: {
      status: "Blocked",
    },
  });
}

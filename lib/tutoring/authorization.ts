import prisma from "@/lib/prisma";

export async function getTutoringAppointmentForUser({
  appointmentId,
  userId,
}: {
  appointmentId: string;
  userId: string;
}) {
  return prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      OR: [
        {
          learnerId: userId,
        },
        {
          educatorId: userId,
        },
      ],
    },
    include: {
      learner: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
      educator: {
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
      tutoringSlot: true,
      whiteboard: true,
    },
  });
}

export function isTutoringParticipant({
  appointment,
  userId,
}: {
  appointment: {
    learnerId: string;
    educatorId: string;
  };
  userId: string;
}) {
  return appointment.learnerId === userId || appointment.educatorId === userId;
}

export function isTutoringTutor({
  appointment,
  userId,
}: {
  appointment: {
    educatorId: string;
  };
  userId: string;
}) {
  return appointment.educatorId === userId;
}

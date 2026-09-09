import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Returns the authenticated user plus the universal profiles/capabilities
 * needed by the application. The legacy role and FacilitatorProfile are
 * intentionally retained during the architecture transition.
 */
export const getAuthenticatedUser = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      phoneNumber: true,
      role: true,
      onboardingCompleted: true,
      status: true,
      verificationStatus: true,
      stripeCustomerId: true,

      // Capability flags make the application role-agnostic.
      canLearn: true,
      canTeach: true,
      canTutor: true,
      canCreateResources: true,
      canPublish: true,
      canSell: true,
      canManageChildren: true,
      canManageSchool: true,

      learningProfile: {
        select: {
          id: true,
          gradeLevel: true,
          schoolName: true,
          learningGoals: true,
          preferredSubjects: true,
          interests: true,
          preferredLanguage: true,
          timezone: true,
        },
      },

      teachingProfile: {
        select: {
          id: true,
          headline: true,
          specialty: true,
          experience: true,
          credentialUrl: true,
          description: true,
          verificationStatus: true,
          hourlyRate: true,
          currency: true,
          subjects: true,
          gradeLevels: true,
        },
      },

      creatorProfile: {
        select: {
          id: true,
          displayName: true,
          bio: true,
          specialties: true,
          websiteUrl: true,
          socialLinks: true,
        },
      },

      capabilities: {
        select: {
          capability: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
      },

      permissions: {
        select: {
          permission: true,
        },
      },

      // Temporary compatibility for existing tutoring/auth consumers.
      facilitatorProfile: {
        select: {
          specialty: true,
          experience: true,
          credentialUrl: true,
          description: true,
          verificationStatus: true,
        },
      },
    },
  });
});

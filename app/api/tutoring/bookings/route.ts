import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const TUTORING_HOURLY_RATE_CENTS = 3500;
const DEFAULT_CURRENCY = "usd";

export const dynamic = "force-dynamic";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function calculateAmount(startTime: Date, endTime: Date) {
  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000,
  );

  if (durationMinutes <= 0) {
    throw new Error("Tutoring slot duration must be greater than zero.");
  }

  return {
    durationMinutes,
    amount: Math.round((TUTORING_HOURLY_RATE_CENTS / 60) * durationMinutes),
  };
}

/**
 * GET /api/tutoring/bookings
 *
 * Returns only bookings belonging to the authenticated customer.
 * TutoringBooking intentionally has no Prisma relation named `appointment`;
 * appointmentId is a scalar compatibility field. Appointment records are
 * therefore resolved separately and merged into the response.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const bookings = await prisma.tutoringBooking.findMany({
      where: {
        customerId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        customerId: true,
        tutorId: true,
        tutoringSlotId: true,
        subject: true,
        gradeLevel: true,
        topic: true,
        description: true,
        amount: true,
        currency: true,
        status: true,
        stripeSessionId: true,
        paymentIntentId: true,
        appointmentId: true,
        createdAt: true,
        updatedAt: true,
        tutor: {
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
          },
        },
        tutoringSlot: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
      },
    });

    const appointmentIds = bookings
      .map((booking) => booking.appointmentId)
      .filter((id): id is string => Boolean(id));

    const appointments = appointmentIds.length
      ? await prisma.appointment.findMany({
          where: {
            id: {
              in: appointmentIds,
            },
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            videoSessionId: true,
          },
        })
      : [];

    const appointmentById = new Map(
      appointments.map((appointment) => [appointment.id, appointment]),
    );

    const result = bookings.map((booking) => ({
      ...booking,
      appointment: booking.appointmentId
        ? (appointmentById.get(booking.appointmentId) ?? null)
        : null,
    }));

    return NextResponse.json({
      bookings: result,
    });
  } catch (error) {
    console.error("GET /api/tutoring/bookings:", error);

    return NextResponse.json(
      { error: "Unable to load tutoring bookings." },
      { status: 500 },
    );
  }
}

type CreateBookingBody = {
  tutorId?: unknown;
  slotId?: unknown;
  subject?: unknown;
  gradeLevel?: unknown;
  topic?: unknown;
  description?: unknown;
};

/**
 * POST /api/tutoring/bookings
 *
 * Creates a pending tutoring booking and reserves the selected slot before
 * sending the customer to Stripe Checkout.
 *
 * The client never controls the amount. The server calculates the price from
 * the authoritative slot duration at the fixed tutoring rate.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: CreateBookingBody;

    try {
      body = (await request.json()) as CreateBookingBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const tutorId = typeof body.tutorId === "string" ? body.tutorId.trim() : "";
    const slotId = typeof body.slotId === "string" ? body.slotId.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const gradeLevel =
      typeof body.gradeLevel === "string" ? body.gradeLevel.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!tutorId || !slotId || !subject || !gradeLevel) {
      return NextResponse.json(
        {
          error: "Tutor, slot, subject, and grade level are required.",
        },
        { status: 400 },
      );
    }

    if (tutorId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot book yourself as the tutor." },
        { status: 400 },
      );
    }

    const tutor = await prisma.user.findFirst({
      where: {
        id: tutorId,
        status: "Active",
        verificationStatus: "Verified",
        facilitatorProfile: {
          verificationStatus: "Verified",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!tutor) {
      return NextResponse.json(
        { error: "Tutor not found or not approved for tutoring." },
        { status: 404 },
      );
    }

    const now = new Date();

    const slot = await prisma.tutoringSlot.findUnique({
      where: {
        id: slotId,
      },
      select: {
        id: true,
        tutorId: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    if (!slot || slot.tutorId !== tutorId) {
      return NextResponse.json(
        {
          error: "The selected tutoring slot is not available for this tutor.",
        },
        { status: 404 },
      );
    }

    if (slot.status !== "Available") {
      return NextResponse.json(
        { error: "The selected tutoring slot is no longer available." },
        { status: 409 },
      );
    }

    if (slot.startTime <= now) {
      return NextResponse.json(
        { error: "The selected tutoring slot has already started." },
        { status: 400 },
      );
    }

    if (slot.endTime <= slot.startTime) {
      return NextResponse.json(
        { error: "The selected tutoring slot has an invalid duration." },
        { status: 400 },
      );
    }

    const { amount, durationMinutes } = calculateAmount(
      slot.startTime,
      slot.endTime,
    );

    if (amount < 50) {
      return NextResponse.json(
        { error: "The tutoring slot is too short to create a payment." },
        { status: 400 },
      );
    }

    const booking = await prisma.$transaction(async (tx) => {
      // Re-read the slot inside the transaction so the reservation decision is
      // made against current database state, not the earlier snapshot.
      const currentSlot = await tx.tutoringSlot.findUnique({
        where: {
          id: slotId,
        },
        select: {
          id: true,
          tutorId: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });

      if (!currentSlot || currentSlot.tutorId !== tutorId) {
        throw new Error("SLOT_NOT_FOUND");
      }

      if (currentSlot.status !== "Available") {
        throw new Error("SLOT_UNAVAILABLE");
      }

      if (currentSlot.startTime <= new Date()) {
        throw new Error("SLOT_STARTED");
      }

      const updatedSlot = await tx.tutoringSlot.updateMany({
        where: {
          id: slotId,
          tutorId,
          status: "Available",
        },
        data: {
          status: "Booked",
        },
      });

      if (updatedSlot.count !== 1) {
        throw new Error("SLOT_UNAVAILABLE");
      }

      return tx.tutoringBooking.create({
        data: {
          customerId: session.user.id,
          tutorId,
          tutoringSlotId: slotId,
          subject,
          gradeLevel,
          topic: topic || null,
          description: description || null,
          amount,
          currency: DEFAULT_CURRENCY,
          status: "PENDING_PAYMENT",
        },
        select: {
          id: true,
          customerId: true,
          tutorId: true,
          tutoringSlotId: true,
          subject: true,
          gradeLevel: true,
          topic: true,
          description: true,
          amount: true,
          currency: true,
          status: true,
        },
      });
    });

    let checkoutSession: Awaited<
      ReturnType<typeof stripe.checkout.sessions.create>
    >;

    try {
      checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: DEFAULT_CURRENCY,
              unit_amount: booking.amount,
              product_data: {
                name: "One-on-One Live Tutoring",
                description: `${subject} tutoring for ${durationMinutes} minutes.`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: session.user.email || undefined,
        success_url:
          `${getAppUrl()}/tutoring/booking/success` +
          "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          `${getAppUrl()}/tutoring/book` +
          `?tutorId=${encodeURIComponent(tutorId)}` +
          `&booking_id=${encodeURIComponent(booking.id)}` +
          "&cancelled=true",
        metadata: {
          checkoutType: "TUTORING",
          bookingId: booking.id,
          tutorId: booking.tutorId,
          customerId: booking.customerId,
          tutoringSlotId: booking.tutoringSlotId,
          subject: booking.subject,
          gradeLevel: booking.gradeLevel,
          topic: booking.topic || "",
        },
        client_reference_id: booking.id,
      });
    } catch (stripeError) {
      console.error("TUTORING STRIPE CHECKOUT CREATION FAILED:", stripeError);

      await prisma.$transaction(async (tx) => {
        await tx.tutoringBooking.updateMany({
          where: {
            id: booking.id,
            status: "PENDING_PAYMENT",
          },
          data: {
            status: "CANCELLED",
          },
        });

        await tx.tutoringSlot.updateMany({
          where: {
            id: booking.tutoringSlotId,
            tutorId: booking.tutorId,
            status: "Booked",
          },
          data: {
            status: "Available",
          },
        });
      });

      return NextResponse.json(
        { error: "Unable to initialize payment. Please try again." },
        { status: 500 },
      );
    }

    if (!checkoutSession.url) {
      console.error(
        "TUTORING STRIPE CHECKOUT RETURNED NO URL:",
        checkoutSession.id,
      );

      // Do not release the slot here if Stripe has created a real session.
      // The session may still be reachable and a later webhook could arrive.
      return NextResponse.json(
        { error: "Unable to generate the payment page." },
        { status: 500 },
      );
    }

    try {
      await prisma.tutoringBooking.update({
        where: {
          id: booking.id,
        },
        data: {
          stripeSessionId: checkoutSession.id,
        },
      });
    } catch (databaseError) {
      // The Stripe session already exists. Releasing the slot here could allow
      // another customer to book it while Stripe can still complete this one.
      // Keep the reservation and surface a safe retry message instead.
      console.error(
        "TUTORING BOOKING STRIPE SESSION ID SAVE FAILED:",
        databaseError,
      );

      return NextResponse.json(
        {
          error:
            "Payment was initialized but the booking could not be finalized. Please contact support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      bookingId: booking.id,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "SLOT_NOT_FOUND":
          return NextResponse.json(
            { error: "The selected tutoring slot is no longer available." },
            { status: 404 },
          );
        case "SLOT_UNAVAILABLE":
          return NextResponse.json(
            {
              error:
                "The selected tutoring slot was just booked by someone else.",
            },
            { status: 409 },
          );
        case "SLOT_STARTED":
          return NextResponse.json(
            { error: "The selected tutoring slot has already started." },
            { status: 400 },
          );
        default:
          console.error("POST /api/tutoring/bookings:", error);
      }
    } else {
      console.error("POST /api/tutoring/bookings:", error);
    }

    return NextResponse.json(
      { error: "Unable to create tutoring booking." },
      { status: 500 },
    );
  }
}

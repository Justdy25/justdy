"use server";

import arcjet, { fixedWindow } from "@/lib/arcjet";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

import { request } from "@arcjet/next";

import Stripe from "stripe";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// ============================================================
// ARCJET
// ============================================================

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 10,
  }),
);

// ============================================================
// TYPES
// ============================================================

export type CheckoutCartItem = {
  productId: string;
  quantity: number;
};

export type CheckoutResponse = {
  status: "success" | "error";
  message?: string;
  checkoutUrl?: string;
};

// ============================================================
// CREATE CHECKOUT SESSION
// ============================================================

export async function createCheckoutSessionAction(
  cartItems: CheckoutCartItem[],
): Promise<CheckoutResponse> {
  try {
    // ==========================================================
    // 1. REQUEST
    // ==========================================================

    const req = await request();

    // ==========================================================
    // 2. AUTH SESSION
    // ==========================================================

    const authSession = await auth.api.getSession({
      headers: await headers(),
    });

    // ==========================================================
    // 3. GET USER FROM DATABASE
    // ==========================================================

    const user = authSession?.user
      ? await prisma.user.findUnique({
          where: {
            id: authSession.user.id,
          },
          select: {
            id: true,
            email: true,
            name: true,
            stripeCustomerId: true,
            role: true,
          },
        })
      : null;

    // ==========================================================
    // 4. ARCJET
    // ==========================================================

    const decision = await aj.protect(req, {
      fingerprint: user?.id ?? "guest",
    });

    if (decision.isDenied()) {
      return {
        status: "error",
        message: "You have been blocked due to too many requests.",
      };
    }

    // ==========================================================
    // 5. VALIDATE CART
    // ==========================================================

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return {
        status: "error",
        message: "Your cart is empty.",
      };
    }

    // ==========================================================
    // 6. NORMALIZE CART
    // ==========================================================

    const quantityMap = new Map<string, number>();

    for (const item of cartItems) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !item.productId.trim()
      ) {
        continue;
      }

      const productId = item.productId.trim();

      const quantity = Math.max(
        1,
        Math.min(100, Math.floor(Number(item.quantity) || 1)),
      );

      const existing = quantityMap.get(productId) ?? 0;

      quantityMap.set(productId, Math.min(100, existing + quantity));
    }

    if (quantityMap.size === 0) {
      return {
        status: "error",
        message: "Your cart contains no valid products.",
      };
    }

    const productIds = Array.from(quantityMap.keys());

    // ==========================================================
    // 7. DATABASE PRODUCTS
    // ==========================================================

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },

      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        type: true,
        status: true,
        imageKey: true,
      },
    });

    // ==========================================================
    // 8. CHECK MISSING PRODUCTS
    // ==========================================================

    if (products.length !== productIds.length) {
      return {
        status: "error",
        message: "One or more products in your cart are no longer available.",
      };
    }

    // ==========================================================
    // 9. CHECK STATUS
    // ==========================================================

    const unavailable = products.find(
      (product) => product.status !== "Published",
    );

    if (unavailable) {
      return {
        status: "error",
        message: `"${unavailable.title}" is not currently available for purchase.`,
      };
    }

    // ==========================================================
    // 10. CHECK PRICES
    // ==========================================================

    for (const product of products) {
      const price = product.price;

      if (price === null || !Number.isInteger(price) || price < 0) {
        return {
          status: "error",
          message: `"${product.title}" has an invalid price.`,
        };
      }
    }

    // ==========================================================
    // 11. PREVENT DUPLICATE COURSE PURCHASE
    // ==========================================================

    if (user) {
      const courses = products.filter((product) => product.type === "Course");

      for (const course of courses) {
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_productId: {
              userId: user.id,
              productId: course.id,
            },
          },

          select: {
            status: true,
          },
        });

        if (enrollment?.status === "Active") {
          return {
            status: "error",
            message: `You are already enrolled in "${course.title}".`,
          };
        }
      }
    }

    // ==========================================================
    // 12. CREATE STRIPE LINE ITEMS
    // ==========================================================

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      products.map((product) => {
        const quantity = quantityMap.get(product.id) ?? 1;

        // Product has one imageKey in the current schema.
        const imageKey = product.imageKey?.trim();

        let imageUrl: string | undefined;

        if (imageKey) {
          if (
            imageKey.startsWith("http://") ||
            imageKey.startsWith("https://")
          ) {
            imageUrl = imageKey;
          } else {
            imageUrl = `https://utfs.io/f/${imageKey}`;
          }
        }

        const price = product.price;

        if (price === null) {
          throw new Error(`Product "${product.title}" has no valid price.`);
        }

        return {
          price_data: {
            currency: "usd",

            unit_amount: price,

            product_data: {
              name: product.title,

              ...(imageUrl
                ? {
                    images: [imageUrl],
                  }
                : {}),

              metadata: {
                productId: product.id,
                productType: product.type,
                source: "Justdy",
              },
            },
          },

          quantity,
        };
      });

    // ==========================================================
    // 13. TOTAL QUANTITY
    // ==========================================================

    const totalQuantity = Array.from(quantityMap.values()).reduce(
      (total, quantity) => total + quantity,
      0,
    );

    // ==========================================================
    // 14. APP URL
    // ==========================================================

    const appUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");

    // ==========================================================
    // 15. SESSION PARAMETERS
    // ==========================================================

    const params: Stripe.Checkout.SessionCreateParams = {
      line_items: lineItems,

      mode: "payment",

      payment_method_types: ["card"],

      name_collection: {
        individual: {
          enabled: true,
          optional: false,
        },
      },

      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${appUrl}/payment/cancel`,

      metadata: {
        purchaseType: "product",
        itemCount: String(products.length),
        totalQuantity: String(totalQuantity),
        userId: user?.id ?? "",
      },
    };

    // ==========================================================
    // 16. CUSTOMER
    // ==========================================================

    if (user) {
      if (user.stripeCustomerId) {
        params.customer = user.stripeCustomerId;

        params.customer_update = {
          name: "auto",
        };
      } else if (user.email) {
        params.customer_email = user.email;
        params.customer_creation = "always";
      }
    } else {
      params.customer_creation = "always";
    }

    // ==========================================================
    // 17. LOG CHECKOUT
    // ==========================================================

    console.log("CREATING PRODUCT CHECKOUT:", {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      guest: !user,
      products: productIds,
      totalQuantity,
    });

    // ==========================================================
    // 18. CREATE STRIPE SESSION
    // ==========================================================

    const checkoutSession = await stripe.checkout.sessions.create(params);

    // ==========================================================
    // 19. CHECK CHECKOUT URL
    // ==========================================================

    if (!checkoutSession.url) {
      return {
        status: "error",
        message: "Failed to generate checkout session URL.",
      };
    }

    // ==========================================================
    // 20. LOG CREATED SESSION
    // ==========================================================

    console.log("CHECKOUT CREATED:", {
      sessionId: checkoutSession.id,
    });

    // ==========================================================
    // 21. RETURN CHECKOUT URL
    // ==========================================================

    return {
      status: "success",
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    console.error("CHECKOUT SESSION CREATION ERROR:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return {
        status: "error",
        message: `Stripe error: ${error.message}`,
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Failed to process checkout.",
    };
  }
}

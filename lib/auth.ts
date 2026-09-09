import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { Resend } from "resend";

// ============================================================
// RESEND
// ============================================================

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("RESEND_API_KEY is not configured.");
}

const resend = new Resend(resendApiKey);

// ============================================================
// USER TYPE
// ============================================================

export interface User {
  id: string;
  email: string;
  role?: string;
  verificationStatus?: string;
}

// ============================================================
// PURCHASE DATA HELPER
// ============================================================

// Stripe checkout account setup uses Better Auth's password-reset
// flow. Better Auth may wrap redirectTo inside callbackURL, so we
// inspect both the generated reset URL and nested callback URLs.

function getPurchaseDataFromResetUrl(resetUrl: string): {
  items?: Array<{
    title: string;
    type: string;
    quantity: number;
    amount: number;
    accessType: "course" | "download";
  }>;
  amountPaid?: string;
  dashboardUrl?: string;
} | null {
  try {
    const appUrl =
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const visited = new Set<string>();

    type PurchaseEmailData = {
      items?: Array<{
        title: string;
        type: string;
        quantity: number;
        amount: number;
        accessType: "course" | "download";
      }>;
      amountPaid?: string;
      dashboardUrl?: string;
    };

    function inspectUrl(rawUrl: string, depth = 0): PurchaseEmailData | null {
      if (!rawUrl || depth > 3 || visited.has(rawUrl)) {
        return null;
      }

      visited.add(rawUrl);

      let parsed: URL;

      try {
        parsed = new URL(rawUrl, appUrl);
      } catch {
        return null;
      }

      const checkoutSetup = parsed.searchParams.get("checkoutSetup");

      const encodedPurchaseData = parsed.searchParams.get("purchaseData");

      if (checkoutSetup === "true" && encodedPurchaseData) {
        try {
          const decodedData = Buffer.from(
            encodedPurchaseData,
            "base64url",
          ).toString("utf8");

          return JSON.parse(decodedData);
        } catch (error) {
          console.error("FAILED TO DECODE DIRECT PURCHASE DATA:", error);

          return null;
        }
      }

      const nestedUrls = [
        parsed.searchParams.get("callbackURL"),
        parsed.searchParams.get("callbackUrl"),
      ];

      for (const nestedUrl of nestedUrls) {
        if (!nestedUrl) {
          continue;
        }

        const nestedResult = inspectUrl(nestedUrl, depth + 1);

        if (nestedResult) {
          return nestedResult;
        }
      }

      return null;
    }

    const result = inspectUrl(resetUrl);

    if (!result) {
      console.log("NO JUSTDY CHECKOUT PURCHASE DATA FOUND IN RESET URL");
    }

    return result;
  } catch (error) {
    console.error("FAILED TO READ JUSTDY PURCHASE DATA FROM RESET URL:", error);

    return null;
  }
}

// ============================================================
// BETTER AUTH
// ============================================================

export const auth = betterAuth({
  appName: "Justdy",

  // ==========================================================
  // PRODUCTION URL
  // ==========================================================

  /*
   * www.justdy.com is the canonical production domain.
   *
   * This prevents Better Auth from generating authentication
   * URLs against justdy.com, which redirects to www.justdy.com.
   *
   * The redirect was causing browser CORS/preflight failures.
   */

  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",

  // ==========================================================
  // TRUSTED ORIGINS
  // ==========================================================

  /*
   * Better Auth validates authentication request origins.
   *
   * www.justdy.com is the canonical production origin.
   * justdy.com is included because the apex domain still exists
   * and redirects to www.justdy.com.
   */

  trustedOrigins: [
    "https://www.justdy.com",
    "https://justdy.com",
    "http://localhost:3000",
  ],

  // ==========================================================
  // DATABASE
  // ==========================================================

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // ==========================================================
  // USER
  // ==========================================================

  user: {
    fields: {
      image: "image",
    },
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "Learner",
        input: false,
      },

      verificationStatus: {
        type: "string",
        required: false,
        defaultValue: "Pending",
        input: false,
      },
    },
  },

  // ==========================================================
  // DATABASE HOOKS
  // ==========================================================

  databaseHooks: {
    user: {
      update: {
        after: async (user) => {
          try {
            const dbUser = await prisma.user.findUnique({
              where: {
                id: user.id,
              },
              select: {
                id: true,
                email: true,
                emailVerified: true,
              },
            });

            if (!dbUser) {
              console.error("DATABASE HOOK: User not found:", user.id);
              return;
            }

            // User-update hook intentionally contains no learner,
            // educator, or administrator workflow.
            //
            // Authentication is now role-agnostic. AI, projects,
            // library, and creation features authorize against the
            // authenticated user directly.
          } catch (error) {
            console.error("DATABASE USER UPDATE HOOK FAILED:", error);
          }
        },
      },
    },
  },

  // ==========================================================
  // EMAIL + PASSWORD
  // ==========================================================

  emailAndPassword: {
    enabled: true,

    autoSignIn: false,

    minPasswordLength: 8,

    maxPasswordLength: 128,

    // --------------------------------------------------------
    // IMPORTANT
    //
    // Keep verification required for normal users.
    //
    // But DO NOT automatically send verification email during
    // sign-up.
    //
    // Stripe checkout will use the password-reset token as
    // the account setup mechanism instead.
    // --------------------------------------------------------

    requireEmailVerification: true,

    // ========================================================
    // PASSWORD RESET / STRIPE ACCOUNT SETUP
    // ========================================================

    sendResetPassword: async ({ user, url }): Promise<void> => {
      try {
        // ========================================================
        // DETECT STRIPE CHECKOUT ACCOUNT SETUP
        // ========================================================

        // Do not depend on custom request headers here.
        // Better Auth may not preserve those headers when this
        // callback executes.
        //
        // Stripe instead places checkoutSetup=true and
        // purchaseData inside redirectTo.

        let isCheckoutAccountSetup = false;

        try {
          const parsedUrl = new URL(url);

          const directMarker =
            parsedUrl.searchParams.get("checkoutSetup") === "true";

          const callbackCandidates = [
            parsedUrl.searchParams.get("callbackURL"),
            parsedUrl.searchParams.get("callbackUrl"),
          ];

          let nestedMarker = false;

          for (const candidate of callbackCandidates) {
            if (!candidate) {
              continue;
            }

            try {
              const nestedUrl = new URL(
                candidate,
                process.env.BETTER_AUTH_URL ||
                  process.env.NEXT_PUBLIC_APP_URL ||
                  "http://localhost:3000",
              );

              if (nestedUrl.searchParams.get("checkoutSetup") === "true") {
                nestedMarker = true;
                break;
              }
            } catch {
              // Ignore malformed optional callback URLs.
            }
          }

          isCheckoutAccountSetup = directMarker || nestedMarker;
        } catch (error) {
          console.error("FAILED TO PARSE PASSWORD RESET URL:", error);
        }

        console.log("PASSWORD RESET EMAIL REQUEST:", {
          email: user.email,
          isCheckoutAccountSetup,
          resetUrl: url,
        });

        // ========================================================
        // STRIPE CHECKOUT
        //
        // ONE EMAIL ONLY:
        // PURCHASE CONFIRMATION + ACCOUNT SETUP
        // ========================================================

        if (isCheckoutAccountSetup) {
          console.log(
            "SENDING SINGLE PURCHASE + ACCOUNT SETUP EMAIL:",
            user.email,
          );

          const purchaseData = getPurchaseDataFromResetUrl(url);

          const { render } = await import("@react-email/render");

          const PurchaseConfirmationEmail = (
            await import("@/app/_components/emails/PurchaseConfirmationEmail")
          ).default;

          const appUrl = (
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.BETTER_AUTH_URL ||
            "http://localhost:3000"
          ).replace(/\/$/, "");

          const emailHtml = await render(
            PurchaseConfirmationEmail({
              username: user.name?.trim() || "Learner",

              email: user.email,

              setupUrl: url,

              items: purchaseData?.items ?? [],

              amountPaid: purchaseData?.amountPaid ?? "0.00",

              dashboardUrl: purchaseData?.dashboardUrl ?? `${appUrl}/library`,

              isNewAccount: true,
            }),
          );

          const result = await resend.emails.send({
            from: "Justdy <onboarding@justdy.com>",

            to: [user.email.trim().toLowerCase()],

            subject: "Your Justdy Purchase Was Successful",

            html: emailHtml,
          });

          if (result.error) {
            console.error(
              "PURCHASE + ACCOUNT SETUP EMAIL ERROR:",
              result.error,
            );

            return;
          }

          console.log("SINGLE PURCHASE + ACCOUNT SETUP EMAIL SENT:", {
            email: user.email,
            emailId: result.data?.id,
            purchaseItemCount: purchaseData?.items?.length ?? 0,
            amountPaid: purchaseData?.amountPaid ?? "0.00",
          });

          return;
        }

        // ========================================================
        // NORMAL PASSWORD RESET
        // ========================================================

        const { render } = await import("@react-email/render");

        const ForgotPasswordEmail = (
          await import("@/app/_components/ForgotPasswordEmail")
        ).default;

        const emailHtml = await render(
          ForgotPasswordEmail({
            username: user.name ?? "User",

            userEmail: user.email,

            resetUrl: url,
          }),
        );

        const result = await resend.emails.send({
          from: "Justdy <onboarding@justdy.com>",

          to: [user.email.trim().toLowerCase()],

          subject: "Reset Your Justdy Password",

          html: emailHtml,
        });

        if (result.error) {
          console.error("PASSWORD RESET EMAIL ERROR:", result.error);

          return;
        }

        console.log("PASSWORD RESET EMAIL SENT:", {
          email: user.email,
          emailId: result.data?.id,
        });
      } catch (error) {
        console.error("PASSWORD RESET / ACCOUNT EMAIL FAILED:", error);
      }
    },

    revokeSessionsOnPasswordReset: true,
  },

  // ==========================================================
  // EMAIL VERIFICATION
  // ==========================================================

  emailVerification: {
    // ========================================================
    // CRITICAL
    //
    // DO NOT AUTOMATICALLY SEND VERIFICATION EMAIL ON SIGNUP.
    //
    // This eliminates the first email from the Stripe checkout.
    // ========================================================

    sendOnSignUp: false,

    sendVerificationEmail: async ({ user, url }): Promise<void> => {
      try {
        // ====================================================
        // NORMAL LMS VERIFICATION
        //
        // This can still be manually triggered by your normal
        // signup flow.
        // ====================================================

        const VerifyEmail = (await import("@/app/_components/VerifyEmail"))
          .default;

        const result = await resend.emails.send({
          from: "Justdy <onboarding@justdy.com>",

          to: [user.email.trim().toLowerCase()],

          subject: "Verify Your Justdy Account",

          react: VerifyEmail({
            username: user.name ?? "there",

            verifyUrl: url,
          }),
        });

        if (result.error) {
          console.error("VERIFICATION EMAIL ERROR:", result.error);

          return;
        }

        console.log("VERIFICATION EMAIL SENT:", {
          email: user.email,
          emailId: result.data?.id,
        });
      } catch (error) {
        console.error("VERIFICATION EMAIL FAILED:", error);
      }
    },

    autoSignInAfterVerification: false,
  },
});

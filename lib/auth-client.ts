"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  /*
   * The authentication API is served by this same Next.js
   * application.
   *
   * Because the frontend and Better Auth API share the same origin,
   * Better Auth automatically uses:
   *
   *   http://localhost:3000/api/auth/*
   *
   * locally, and:
   *
   *   https://www.justdy.com/api/auth/*
   *
   * in production.
   *
   * Do not hard-code www.justdy.com here because that would cause
   * localhost development requests to leave the current origin.
   */
  plugins: [adminClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

export type User = typeof authClient.$Infer.Session.user;

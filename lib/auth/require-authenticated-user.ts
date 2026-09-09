import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuthenticatedUser } from "./get-authenticated-user";

export const requireAuthenticatedUser = cache(async () => {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

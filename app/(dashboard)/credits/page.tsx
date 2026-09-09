import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import CreditsClient from "@/app/_components/CreditsClient";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return <CreditsClient userName={user.name ?? ""} />;
}

import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import SettingsClient from "@/app/_components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        name: user.name ?? "",
        email: user.email,
        image: user.imageUrl ?? "",
      }}
    />
  );
}

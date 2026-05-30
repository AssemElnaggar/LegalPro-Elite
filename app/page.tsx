import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/core";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await getSessionContext();
  redirect(session ? "/dashboard?section=overview" : "/login");
}

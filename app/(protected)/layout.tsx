import type { ReactNode } from "react";

import { requireUser } from "@/lib/core";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

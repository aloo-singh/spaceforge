import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminUser } from "@/lib/supabase/admin";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireAdminUser();

  return <AdminShell userEmail={user.email ?? "Unknown admin"}>{children}</AdminShell>;
}

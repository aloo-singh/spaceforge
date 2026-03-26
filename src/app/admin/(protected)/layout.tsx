import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { fetchUnreadFeedbackSubmissionCount } from "@/lib/feedback/server";
import { requireAdminUser } from "@/lib/supabase/admin";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireAdminUser();
  const unreadFeedbackCount = await fetchUnreadFeedbackSubmissionCount();

  return (
    <AdminShell userEmail={user.email ?? "Unknown admin"} unreadFeedbackCount={unreadFeedbackCount}>
      {children}
    </AdminShell>
  );
}

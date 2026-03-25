import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getAuthenticatedAdminUser, getAuthenticatedSupabaseUser } from "@/lib/supabase/admin";

export default async function AdminLoginPage() {
  const adminUser = await getAuthenticatedAdminUser();
  if (adminUser) {
    redirect("/admin");
  }

  const authenticatedUser = await getAuthenticatedSupabaseUser();

  return <AdminLoginForm signedInEmail={authenticatedUser?.email ?? null} />;
}

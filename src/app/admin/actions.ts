"use server";

import { redirect } from "next/navigation";

import { signOutAuthenticatedUser } from "@/lib/supabase/admin";

export async function logoutAdminAction() {
  await signOutAuthenticatedUser();
  redirect("/");
}

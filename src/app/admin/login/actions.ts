"use server";

import { redirect } from "next/navigation";

import {
  isAdminEmail,
  setAuthenticatedSessionCookie,
  signInWithPassword,
} from "@/lib/supabase/admin";

export type AdminLoginActionState = {
  error: string | null;
};

export async function loginAdminAction(
  _previousState: AdminLoginActionState,
  formData: FormData
): Promise<AdminLoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Enter both email and password.",
    };
  }

  const session = await signInWithPassword(email, password);
  if (!session) {
    return {
      error: "Login failed. Check your credentials and try again.",
    };
  }

  const authenticatedEmail = session.user?.email ?? email;
  if (!isAdminEmail(authenticatedEmail)) {
    return {
      error: "This account does not have admin access.",
    };
  }

  await setAuthenticatedSessionCookie(session);
  redirect("/admin");
}

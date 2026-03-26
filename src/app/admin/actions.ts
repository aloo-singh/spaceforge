"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  markAllFeedbackSubmissionsAsRead,
  markFeedbackSubmissionAsRead,
} from "@/lib/feedback/server";
import { signOutAuthenticatedUser } from "@/lib/supabase/admin";

export async function logoutAdminAction() {
  await signOutAuthenticatedUser();
  redirect("/");
}

export async function markFeedbackSubmissionReadAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "").trim();
  if (!submissionId) {
    return;
  }

  await markFeedbackSubmissionAsRead(submissionId);
  revalidatePath("/admin");
}

export async function markAllFeedbackSubmissionsReadAction() {
  await markAllFeedbackSubmissionsAsRead();
  revalidatePath("/admin");
}

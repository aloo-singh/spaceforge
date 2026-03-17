import type { AnalyticsEvent } from "@/lib/analytics/types";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export async function persistAnalyticsEvent(event: AnalyticsEvent) {
  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    return { persisted: false as const, reason: "missing_supabase_config" as const };
  }

  const response = await fetch(`${supabaseConfig.url}/rest/v1/analytics_events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.serviceRoleKey,
      Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event: event.event,
      timestamp: event.timestamp,
      session_id: event.sessionId,
      route: event.route,
      version: event.version,
      source: event.source,
      properties: event.properties ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase analytics insert failed: ${response.status} ${errorText}`);
  }

  return { persisted: true as const };
}

import type { EditorDocumentState } from "@/lib/editor/history";
import { cloneProjectDocument, isProjectDocument, type AppUser, type ProjectListItem, type ProjectRecord } from "@/lib/projects/types";
import { getSupabaseServerConfig } from "@/lib/supabase/server";

type SupabaseAppUserRow = {
  id: string;
  client_token: string;
  created_at: string;
  updated_at: string;
};

type SupabaseProjectRow = {
  id: string;
  user_id: string;
  name: string;
  document: unknown;
  created_at: string;
  updated_at: string;
};

function assertSupabaseConfig() {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new Error("Missing Supabase server configuration.");
  }

  return config;
}

function createRestUrl(pathname: string, searchParams?: URLSearchParams) {
  const config = assertSupabaseConfig();
  const url = new URL(`/rest/v1/${pathname}`, config.url);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url;
}

async function supabaseRequest(pathname: string, init: RequestInit, searchParams?: URLSearchParams) {
  const config = assertSupabaseConfig();
  const response = await fetch(createRestUrl(pathname, searchParams), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorText}`);
  }

  return response;
}

function mapAppUser(row: SupabaseAppUserRow): AppUser {
  return {
    id: row.id,
    clientToken: row.client_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectRecord(row: SupabaseProjectRow): ProjectRecord {
  if (!isProjectDocument(row.document)) {
    throw new Error(`Project ${row.id} has an invalid document payload.`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    document: cloneProjectDocument(row.document),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectListItem(row: Omit<SupabaseProjectRow, "document">): ProjectListItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateAppUserByClientToken(clientToken: string): Promise<AppUser> {
  const searchParams = new URLSearchParams({
    select: "id,client_token,created_at,updated_at",
    client_token: `eq.${clientToken}`,
    limit: "1",
  });
  const existingResponse = await supabaseRequest("app_users", { method: "GET" }, searchParams);
  const existingRows = (await existingResponse.json()) as SupabaseAppUserRow[];
  const existingUser = existingRows[0];
  if (existingUser) {
    return mapAppUser(existingUser);
  }

  try {
    const createResponse = await supabaseRequest("app_users", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        client_token: clientToken,
      }),
    });
    const createdRows = (await createResponse.json()) as SupabaseAppUserRow[];
    const createdUser = createdRows[0];
    if (!createdUser) {
      throw new Error("Supabase user insert returned no row.");
    }
    return mapAppUser(createdUser);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("duplicate key")) {
      throw error;
    }

    const retryResponse = await supabaseRequest("app_users", { method: "GET" }, searchParams);
    const retryRows = (await retryResponse.json()) as SupabaseAppUserRow[];
    const retryUser = retryRows[0];
    if (!retryUser) {
      throw error;
    }

    return mapAppUser(retryUser);
  }
}

export async function createProjectForClientToken(
  clientToken: string,
  input: {
    name: string;
    document: EditorDocumentState;
  }
): Promise<ProjectRecord> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const response = await supabaseRequest("projects", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: user.id,
      name: input.name,
      document: cloneProjectDocument(input.document),
    }),
  });
  const rows = (await response.json()) as SupabaseProjectRow[];
  const row = rows[0];
  if (!row) {
    throw new Error("Supabase project insert returned no row.");
  }

  return mapProjectRecord(row);
}

export async function fetchProjectsForClientToken(clientToken: string): Promise<ProjectListItem[]> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const searchParams = new URLSearchParams({
    select: "id,user_id,name,created_at,updated_at",
    user_id: `eq.${user.id}`,
    order: "updated_at.desc",
  });
  const response = await supabaseRequest("projects", { method: "GET" }, searchParams);
  const rows = (await response.json()) as Array<Omit<SupabaseProjectRow, "document">>;
  return rows.map(mapProjectListItem);
}

export async function fetchProjectForClientToken(
  clientToken: string,
  projectId: string
): Promise<ProjectRecord | null> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const searchParams = new URLSearchParams({
    select: "id,user_id,name,document,created_at,updated_at",
    id: `eq.${projectId}`,
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const response = await supabaseRequest("projects", { method: "GET" }, searchParams);
  const rows = (await response.json()) as SupabaseProjectRow[];
  const row = rows[0];
  return row ? mapProjectRecord(row) : null;
}

export async function updateProjectForClientToken(
  clientToken: string,
  projectId: string,
  input: {
    name?: string;
    document?: EditorDocumentState;
  }
): Promise<ProjectRecord | null> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.document !== undefined) {
    updates.document = cloneProjectDocument(input.document);
  }

  const searchParams = new URLSearchParams({
    id: `eq.${projectId}`,
    user_id: `eq.${user.id}`,
    select: "id,user_id,name,document,created_at,updated_at",
  });
  const response = await supabaseRequest(
    "projects",
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(updates),
    },
    searchParams
  );
  const rows = (await response.json()) as SupabaseProjectRow[];
  const row = rows[0];
  return row ? mapProjectRecord(row) : null;
}

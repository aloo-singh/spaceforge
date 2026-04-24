import type { EditorDocumentState } from "@/lib/editor/history";
import {
  cloneProjectDocument,
  isProjectDocument,
  isProjectThumbnailDataUrl,
  resolveProjectMaxFloors,
  type AppUser,
  type ProjectListItem,
  type ProjectRecord,
} from "@/lib/projects/types";
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
  thumbnail_data_url: unknown;
  max_floors: unknown;
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
  if (!isProjectThumbnailDataUrl(row.thumbnail_data_url)) {
    throw new Error(`Project ${row.id} has an invalid thumbnail payload.`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    document: cloneProjectDocument(row.document),
    thumbnailDataUrl: row.thumbnail_data_url ?? null,
    maxFloors: resolveProjectMaxFloors(row.max_floors),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectListItem(row: Omit<SupabaseProjectRow, "document">): ProjectListItem {
  if (!isProjectThumbnailDataUrl(row.thumbnail_data_url)) {
    throw new Error(`Project ${row.id} has an invalid thumbnail payload.`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    thumbnailDataUrl: row.thumbnail_data_url ?? null,
    maxFloors: resolveProjectMaxFloors(row.max_floors),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchAppUserByClientToken(clientToken: string): Promise<AppUser | null> {
  const searchParams = new URLSearchParams({
    select: "id,client_token,created_at,updated_at",
    client_token: `eq.${clientToken}`,
    limit: "1",
  });
  const response = await supabaseRequest("app_users", { method: "GET" }, searchParams);
  const rows = (await response.json()) as SupabaseAppUserRow[];
  const row = rows[0];
  return row ? mapAppUser(row) : null;
}

export async function getOrCreateAppUserByClientToken(clientToken: string): Promise<AppUser> {
  const existingUser = await fetchAppUserByClientToken(clientToken);
  if (existingUser) {
    return existingUser;
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

    const retryUser = await fetchAppUserByClientToken(clientToken);
    if (!retryUser) {
      throw error;
    }

    return retryUser;
  }
}

export async function createProjectForClientToken(
  clientToken: string,
  input: {
    name: string;
    document: EditorDocumentState;
    projectId?: string;
  }
): Promise<ProjectRecord> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const response = await supabaseRequest("projects", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: input.projectId,
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
    select: "id,user_id,name,thumbnail_data_url,max_floors,created_at,updated_at",
    user_id: `eq.${user.id}`,
    order: "updated_at.desc",
  });
  const response = await supabaseRequest("projects", { method: "GET" }, searchParams);
  const rows = (await response.json()) as Array<Omit<SupabaseProjectRow, "document">>;
  return rows.map(mapProjectListItem);
}

export async function existingClientTokenHasProjects(clientToken: string): Promise<boolean> {
  const user = await fetchAppUserByClientToken(clientToken);
  if (!user) {
    return false;
  }

  const searchParams = new URLSearchParams({
    select: "id",
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const response = await supabaseRequest("projects", { method: "GET" }, searchParams);
  const rows = (await response.json()) as Array<Pick<SupabaseProjectRow, "id">>;
  return rows.length > 0;
}

export async function fetchProjectForClientToken(
  clientToken: string,
  projectId: string
): Promise<ProjectRecord | null> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const searchParams = new URLSearchParams({
    select: "id,user_id,name,document,thumbnail_data_url,max_floors,created_at,updated_at",
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
    thumbnailDataUrl?: string | null;
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
  if (input.thumbnailDataUrl !== undefined) {
    updates.thumbnail_data_url = input.thumbnailDataUrl;
  }

  const searchParams = new URLSearchParams({
    id: `eq.${projectId}`,
    user_id: `eq.${user.id}`,
    select: "id,user_id,name,document,thumbnail_data_url,max_floors,created_at,updated_at",
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

export async function deleteProjectForClientToken(
  clientToken: string,
  projectId: string
): Promise<ProjectRecord | null> {
  const user = await getOrCreateAppUserByClientToken(clientToken);
  const searchParams = new URLSearchParams({
    id: `eq.${projectId}`,
    user_id: `eq.${user.id}`,
    select: "id,user_id,name,document,thumbnail_data_url,max_floors,created_at,updated_at",
  });
  const response = await supabaseRequest(
    "projects",
    {
      method: "DELETE",
      headers: {
        Prefer: "return=representation",
      },
    },
    searchParams
  );
  const rows = (await response.json()) as SupabaseProjectRow[];
  const row = rows[0];
  return row ? mapProjectRecord(row) : null;
}

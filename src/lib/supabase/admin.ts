import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type SupabaseAuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: {
    id?: string;
    email?: string | null;
  } | null;
};

const ADMIN_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

type AdminSessionCookie = {
  userId: string;
  email: string;
  expiresAt: number;
};

function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function getAdminEmails(): Set<string> {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    return new Set();
  }

  return new Set(
    adminEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
  );
}

function getSupabaseAuthCookieName() {
  return "sb-spaceforge-auth-token";
}

function getAdminSessionCookieName() {
  return "spaceforge-admin-session";
}

function getAdminSessionSigningSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    "="
  );

  return Buffer.from(paddedValue, "base64").toString("utf-8");
}

function parseAccessToken(rawValue: string): string | null {
  const normalizedValue = rawValue.startsWith("base64-")
    ? decodeBase64Url(rawValue.slice("base64-".length))
    : rawValue;

  try {
    const parsedValue = JSON.parse(normalizedValue) as unknown;

    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      "access_token" in parsedValue &&
      typeof parsedValue.access_token === "string"
    ) {
      return parsedValue.access_token;
    }

    if (Array.isArray(parsedValue) && typeof parsedValue[0] === "string") {
      return parsedValue[0];
    }
  } catch {
    if (normalizedValue.split(".").length === 3) {
      return normalizedValue;
    }
  }

  return null;
}

function parseAccessTokenClaims(accessToken: string): { userId?: string; email?: string } {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || !parts[1]) return {};

  try {
    const claims = JSON.parse(decodeBase64Url(parts[1])) as {
      sub?: unknown;
      email?: unknown;
      user_metadata?: { email?: unknown };
    };

    return {
      userId: typeof claims.sub === "string" ? claims.sub : undefined,
      email:
        typeof claims.email === "string"
          ? claims.email
          : typeof claims.user_metadata?.email === "string"
            ? claims.user_metadata.email
            : undefined,
    };
  } catch {
    return {};
  }
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function signAdminSessionPayload(payload: string) {
  const secret = getAdminSessionSigningSecret();
  if (!secret) return null;

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function serializeAdminSessionCookie(session: AdminSessionCookie) {
  const payload = encodeBase64Url(JSON.stringify(session));
  const signature = signAdminSessionPayload(payload);
  if (!signature) return null;

  return `${payload}.${signature}`;
}

function parseAdminSessionCookie(rawValue: string): AdminSessionCookie | null {
  const [payload, signature] = rawValue.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signAdminSessionPayload(payload);
  if (!expectedSignature) return null;

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as Partial<AdminSessionCookie>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

async function getSupabaseAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const authCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-") && name.includes("-auth-token"));

  if (authCookieNames.length === 0) {
    return null;
  }

  const baseCookieNames = Array.from(
    new Set(authCookieNames.map((name) => name.replace(/\.\d+$/, "")))
  );

  for (const baseCookieName of baseCookieNames) {
    const chunkedCookies = cookieStore
      .getAll()
      .filter((cookie) => cookie.name === baseCookieName || cookie.name.startsWith(`${baseCookieName}.`))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));

    const combinedValue = chunkedCookies.map((cookie) => cookie.value).join("");
    const accessToken = parseAccessToken(combinedValue);

    if (accessToken) {
      return accessToken;
    }
  }

  return null;
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().has(email.toLowerCase());
}

export async function getAuthenticatedSupabaseUser(): Promise<SupabaseAuthUser | null> {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const accessToken = await getSupabaseAccessTokenFromCookies();
  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as Partial<SupabaseAuthUser> | null;
  if (!user || typeof user.id !== "string") {
    return null;
  }

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : null,
  };
}

export async function getAuthenticatedAdminUser(): Promise<SupabaseAuthUser | null> {
  const adminSession = await getAuthenticatedAdminSessionUser();
  if (adminSession) {
    return adminSession;
  }

  const user = await getAuthenticatedSupabaseUser();
  return isAdminEmail(user?.email) ? user : null;
}

async function getAuthenticatedAdminSessionUser(): Promise<SupabaseAuthUser | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(getAdminSessionCookieName())?.value;
  if (!rawCookie) return null;

  const adminSession = parseAdminSessionCookie(rawCookie);
  if (!adminSession || !isAdminEmail(adminSession.email)) {
    return null;
  }

  return {
    id: adminSession.userId,
    email: adminSession.email,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Missing Supabase public configuration.");
  }

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
    },
    body: JSON.stringify({
      email,
      password,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as Partial<SupabaseAuthSession> | null;
  if (!session || typeof session.access_token !== "string") {
    return null;
  }

  return session as SupabaseAuthSession;
}

export async function setAuthenticatedSessionCookie(session: SupabaseAuthSession) {
  const cookieStore = await cookies();
  const maxAge = ADMIN_SESSION_MAX_AGE_SECONDS;

  cookieStore.set(getSupabaseAuthCookieName(), JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  const tokenClaims = parseAccessTokenClaims(session.access_token);
  const userId = session.user?.id ?? tokenClaims.userId;
  const email = session.user?.email ?? tokenClaims.email;
  if (typeof userId === "string" && typeof email === "string" && isAdminEmail(email)) {
    const adminSessionCookie = serializeAdminSessionCookie({
      userId,
      email,
      expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    });
    if (adminSessionCookie) {
      cookieStore.set(getAdminSessionCookieName(), adminSessionCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
    }
  }
}

export async function clearAuthenticatedSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(getSupabaseAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(getAdminSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function signOutAuthenticatedUser() {
  const config = getSupabasePublicConfig();
  const accessToken = await getSupabaseAccessTokenFromCookies();

  if (config && accessToken) {
    await fetch(`${config.url}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearAuthenticatedSessionCookie();
}

export async function requireAdminUser(): Promise<SupabaseAuthUser> {
  const user = await getAuthenticatedAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return user;
}

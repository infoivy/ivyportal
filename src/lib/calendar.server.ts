import { createHmac, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function signState(userId: string, nonce: string): string {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("GOOGLE_OAUTH_STATE_SECRET not configured");
  const ts = Date.now().toString();
  const payload = `${userId}.${nonce}.${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string): { userId: string } {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("GOOGLE_OAUTH_STATE_SECRET not configured");
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const parts = decoded.split(".");
  if (parts.length !== 4) throw new Error("Invalid state");
  const [userId, nonce, ts, sig] = parts;
  const payload = `${userId}.${nonce}.${ts}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("State signature invalid");
  if (Date.now() - parseInt(ts, 10) > STATE_TTL_MS) throw new Error("State expired");
  return { userId };
}

export function getGoogleClientCreds() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Google Calendar integration is not configured yet. Ask the admin to add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }
  return { id, secret };
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const { id } = getGoogleClientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly openid email",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { id, secret } = getGoogleClientCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const { id, secret } = getGoogleClientCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google refresh failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

export function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (json.email as string) ?? null;
  } catch {
    return null;
  }
}

export type GCalEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink?: string;
  status?: string;
};

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GCalEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar list failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { items?: GCalEvent[] };
  return data.items ?? [];
}

export function getRedirectUri(requestUrl: string): string {
  const u = new URL(requestUrl);
  return `${u.origin}/api/public/google-oauth-callback`;
}

const CLOSER_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#ef4444"];
export function pickColorForIndex(i: number): string {
  return CLOSER_COLORS[i % CLOSER_COLORS.length];
}

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DashboardSession = {
  userId: string;
  username: string;
  displayName: string;
  accessToken: string;
  expiresAt: number;
};

export const SESSION_COOKIE = "logger_session";
export const STATE_COOKIE = "logger_oauth_state";

export function signSession(session: DashboardSession) {
  return sign(JSON.stringify(session));
}

export function verifySession(raw: string): DashboardSession | null {
  const payload = verify(raw);
  if (!payload) return null;
  try {
    const session = JSON.parse(payload) as DashboardSession;
    if (
      typeof session.expiresAt === "number" &&
      session.expiresAt > 0 &&
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

export async function createOAuthState() {
  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(STATE_COOKIE, state, getCookieOptions(10 * 60));
  return state;
}

export async function consumeOAuthState(state: string | null) {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return Boolean(state && expected && state === expected);
}

export async function setSession(session: DashboardSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(session), getCookieOptions(7 * 24 * 60 * 60));
}

export async function getSession() {
  try {
    const store = await cookies();
    const value = store.get(SESSION_COOKIE)?.value;
    if (!value) return null;
    return verifySession(value);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("DYNAMIC_SERVER_USAGE")) {
      throw err;
    }
    return null;
  }
}

export async function clearSession() {
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  } catch {}
}

function sign(payload: string) {
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(value: string) {
  try {
    const [encoded, signature] = value.split(".");
    if (!encoded || !signature) return null;

    const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function secret() {
  const value = process.env.SESSION_SECRET || "fallback_default_logger_session_secret_2026_xyz";
  return value.trim().replace(/^["']|["']$/g, "");
}

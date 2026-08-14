"use server";

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DashboardSession = {
  userId: string;
  username: string;
  displayName: string;
  accessToken: string;
  expiresAt: number;
};

const SESSION_COOKIE = "logger_session";
const STATE_COOKIE = "logger_oauth_state";

export async function createOAuthState() {
  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOptions(10 * 60));
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
  store.set(SESSION_COOKIE, sign(JSON.stringify(session)), cookieOptions(7 * 24 * 60 * 60));
}

export async function getSession() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const payload = verify(value);
  if (!payload) return null;

  const session = JSON.parse(payload) as DashboardSession;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

function sign(payload: string) {
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(value: string) {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return Buffer.from(encoded, "base64url").toString("utf8");
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required");
  return value;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

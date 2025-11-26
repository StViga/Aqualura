import { addDays, isAfter } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { Session, User } from "@/domain/types";
import { getStore } from "@/lib/store";

const SESSION_COOKIE = "aquaria_session";
const SESSION_TTL_DAYS = 14;

export const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

export const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

export const createSession = (userId: string): Session => {
  const store = getStore();
  const token = crypto.randomUUID();
  const createdAt = new Date();
  const expiresAt = addDays(createdAt, SESSION_TTL_DAYS);
  const session: Session = {
    token,
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  store.sessions.set(token, session);
  return session;
};

export const attachSessionCookie = (
  response: NextResponse,
  session: Session,
) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return response;
};

export const destroySession = (token: string | undefined | null) => {
  if (!token) return;
  const store = getStore();
  store.sessions.delete(token);
};

export const clearSessionCookie = async (response: NextResponse) => {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE);
  if (existing) {
    destroySession(existing.value);
  }
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires: new Date(0),
  });
  return response;
};

export const getSessionFromRequest = (
  request: NextRequest,
): Session | null => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = getStore().sessions.get(token);
  if (!session) return null;
  if (isAfter(new Date(), new Date(session.expiresAt))) {
    destroySession(token);
    return null;
  }
  return session;
};

export const requireUserFromRequest = (
  request: NextRequest,
): User | null => {
  const session = getSessionFromRequest(request);
  if (!session) return null;
  const user = getStore().users.get(session.userId) ?? null;
  if (!user) return null;
  return user;
};

export const getAuthenticatedUser = async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = getStore().sessions.get(token);
  if (!session) return null;
  if (isAfter(new Date(), new Date(session.expiresAt))) {
    destroySession(token);
    return null;
  }
  const user = getStore().users.get(session.userId) ?? null;
  return user;
};

import "server-only";

import { type User as SupabaseRawUser } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

import { type User } from "@/domain/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureUserProfile } from "@/services/userService";

type SupabaseUser = SupabaseRawUser;

const extractBearerToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

const getSupabaseUser = async (accessToken: string): Promise<SupabaseUser | null> => {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }
  return data.user;
};

export const requireUserFromRequest = async (
  request: NextRequest,
): Promise<User | null> => {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }
  const supabaseUser = await getSupabaseUser(token);
  if (!supabaseUser) {
    return null;
  }
  return ensureUserProfile(supabaseUser);
};

export const getAuthenticatedUser = async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authToken = headerStore.get("authorization")?.split(" ")[1];
  if (authToken) {
    const supabaseUser = await getSupabaseUser(authToken);
    if (supabaseUser) {
      return ensureUserProfile(supabaseUser);
    }
  }
  const supabaseAccessToken = cookieStore.get("sb-access-token")?.value;
  if (!supabaseAccessToken) {
    return null;
  }
  const supabaseUser = await getSupabaseUser(supabaseAccessToken);
  if (!supabaseUser) {
    return null;
  }
  return ensureUserProfile(supabaseUser);
};

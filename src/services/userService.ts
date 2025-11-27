import { addMonths } from "date-fns";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import {
  type NotificationSettings,
  type Subscription,
  type User,
} from "@/domain/types";
import { getStore } from "@/lib/store";

interface EnsureUserOptions {
  displayName?: string | null;
  provider?: User["authProvider"];
}

export const DEFAULT_TIME_ZONE = "UTC";

const baseNotificationSettings = (): NotificationSettings => ({
  channel: "email",
  preferredTime: "morning",
  timeZone: DEFAULT_TIME_ZONE,
});

const freeSubscription = (): Subscription => ({
  plan: "free",
  startAt: new Date().toISOString(),
  aquariumLimit: 1,
});

export const ensureUserProfile = (
  supabaseUser: SupabaseAuthUser,
  options?: EnsureUserOptions,
): User => {
  const store = getStore();
  const existing = store.users.get(supabaseUser.id);
  if (existing) {
    return existing;
  }
  const nowIso = new Date().toISOString();
  const user: User = {
    id: supabaseUser.id,
    email: supabaseUser.email?.toLowerCase() ?? "",
    displayName: options?.displayName ?? supabaseUser.user_metadata?.name ?? undefined,
    authProvider: options?.provider ?? (supabaseUser.app_metadata?.provider === "google" ? "google" : "password"),
    notificationSettings: baseNotificationSettings(),
    subscription: freeSubscription(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.users.set(user.id, user);
  return user;
};

export const getUserById = (userId: string): User | null => {
  return getStore().users.get(userId) ?? null;
};

export const updateNotificationSettings = (
  userId: string,
  settings: Partial<NotificationSettings>,
): User | null => {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  const updated: User = {
    ...user,
    notificationSettings: {
      ...user.notificationSettings,
      ...settings,
    },
    updatedAt: new Date().toISOString(),
  };
  store.users.set(userId, updated);

  const aquariums = Array.from(store.aquariums.values()).filter(
    (aquarium) => aquarium.userId === userId,
  );
  aquariums.forEach((aquarium) => {
    const tasks = store.careTasks.get(aquarium.id);
    if (!tasks) return;
    store.careTasks.set(
      aquarium.id,
      tasks.map((task) => ({
        ...task,
        channel: updated.notificationSettings.channel,
        updatedAt: new Date().toISOString(),
      })),
    );
  });

  return updated;
};

export const upgradeToPremium = (
  userId: string,
  months: number,
  aquariumLimit = 5,
): User | null => {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  const now = new Date();
  const subscription: Subscription = {
    plan: "premium",
    startAt: now.toISOString(),
    endAt: addMonths(now, months).toISOString(),
    aquariumLimit,
  };
  const updated: User = {
    ...user,
    subscription,
    updatedAt: now.toISOString(),
  };
  store.users.set(userId, updated);
  return updated;
};

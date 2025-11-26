import { addMonths } from "date-fns";
import crypto from "node:crypto";

import {
  NotificationSettings,
  Subscription,
  User,
} from "@/domain/types";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";

interface RegisterPayload {
  email: string;
  password: string;
  displayName?: string;
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

export const registerUser = (
  payload: RegisterPayload,
): { user: User; created: boolean } | { error: string } => {
  const store = getStore();
  const normalizedEmail = payload.email.toLowerCase();
  const existing = Array.from(store.users.values()).find(
    (user) => user.email === normalizedEmail,
  );
  if (existing) {
    return { error: "Пользователь с таким email уже существует." };
  }

  const nowIso = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: hashPassword(payload.password),
    displayName: payload.displayName,
    notificationSettings: baseNotificationSettings(),
    subscription: freeSubscription(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.users.set(user.id, user);
  return { user, created: true };
};

export const authenticateUser = (
  email: string,
  password: string,
): User | null => {
  const store = getStore();
  const normalizedEmail = email.toLowerCase();
  const user = Array.from(store.users.values()).find(
    (candidate) => candidate.email === normalizedEmail,
  );
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
};

export const getUserById = (userId: string): User | null => {
  const user = getStore().users.get(userId) ?? null;
  return user;
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

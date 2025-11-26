import { addDays } from "date-fns";
import crypto from "node:crypto";
import { z } from "zod";

import {
  Aquarium,
  AquariumWithDetails,
  CareTask,
  User,
} from "@/domain/types";
import { findFish, getStore, getUserAquariums } from "@/lib/store";
import { recalculateAquariumInsights } from "@/services/calculationService";

const aquariumInputSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  volumeLiters: z.number().positive("Объем должен быть больше нуля"),
  description: z.string().optional(),
});

const stockInputSchema = z.object({
  speciesId: z.string().min(1),
  quantity: z.number().int().positive("Количество должно быть положительным"),
  sizeClass: z.union([
    z.literal("juvenile"),
    z.literal("medium"),
    z.literal("large"),
  ]).optional(),
});

export const listAquariums = (userId: string): AquariumWithDetails[] => {
  return getUserAquariums(userId);
};

export const getAquarium = (
  userId: string,
  aquariumId: string,
): AquariumWithDetails | null => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== userId) return null;
  const details = getUserAquariums(userId).find((item) => item.id === aquariumId);
  return details ?? null;
};

const ensureWithinLimit = (user: User) => {
  const aquariums = listAquariums(user.id);
  if (aquariums.length >= user.subscription.aquariumLimit) {
    throw new Error("Лимит аквариумов на текущем тарифе исчерпан.");
  }
};

export const createAquarium = (
  user: User,
  input: z.infer<typeof aquariumInputSchema>,
): AquariumWithDetails => {
  ensureWithinLimit(user);
  const payload = aquariumInputSchema.parse(input);
  const nowIso = new Date().toISOString();
  const aquarium: Aquarium = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: payload.name,
    volumeLiters: payload.volumeLiters,
    description: payload.description,
    type: "freshwater",
    isPublic: false,
    status: "comfort",
    compatibilityStatus: "ok",
    bioLoadPercentage: 0,
    requiredVolumeLiters: 0,
    warnings: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const store = getStore();
  store.aquariums.set(aquarium.id, aquarium);
  store.aquariumStock.set(aquarium.id, []);
  store.careTasks.set(aquarium.id, []);
  return getAquarium(user.id, aquarium.id)!;
};

export const updateAquarium = (
  user: User,
  aquariumId: string,
  input: Partial<z.infer<typeof aquariumInputSchema>>,
): AquariumWithDetails | null => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== user.id) return null;
  const payload = aquariumInputSchema.partial().parse(input);
  const updated: Aquarium = {
    ...aquarium,
    ...payload,
    volumeLiters: payload.volumeLiters ?? aquarium.volumeLiters,
    name: payload.name ?? aquarium.name,
    description: payload.description ?? aquarium.description,
    updatedAt: new Date().toISOString(),
  };
  store.aquariums.set(updated.id, updated);
  recalculateAquariumInsights(updated, user);
  return getAquarium(user.id, aquariumId);
};

export const deleteAquarium = (
  userId: string,
  aquariumId: string,
): boolean => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== userId) return false;
  store.aquariums.delete(aquariumId);
  store.aquariumStock.delete(aquariumId);
  store.careTasks.delete(aquariumId);
  return true;
};

export const addFishToAquarium = (
  user: User,
  aquariumId: string,
  input: z.infer<typeof stockInputSchema>,
): AquariumWithDetails | null => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== user.id) return null;
  const payload = stockInputSchema.parse(input);
  const species = findFish(payload.speciesId);
  if (!species) {
    throw new Error("Выбранный вид не найден в справочнике.");
  }

  const stockRecords = store.aquariumStock.get(aquariumId) ?? [];
  const existing = stockRecords.find((record) => record.speciesId === payload.speciesId);
  const nowIso = new Date().toISOString();

  if (existing) {
    existing.quantity += payload.quantity;
    existing.sizeClass = payload.sizeClass ?? existing.sizeClass;
    existing.updatedAt = nowIso;
  } else {
    stockRecords.push({
      id: crypto.randomUUID(),
      aquariumId,
      speciesId: payload.speciesId,
      quantity: payload.quantity,
      sizeClass: payload.sizeClass,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  store.aquariumStock.set(aquariumId, stockRecords);
  recalculateAquariumInsights(store.aquariums.get(aquariumId)!, user);
  return getAquarium(user.id, aquariumId);
};

export const updateStockQuantity = (
  user: User,
  aquariumId: string,
  stockId: string,
  quantity: number,
): AquariumWithDetails | null => {
  if (quantity <= 0) {
    throw new Error("Количество должно быть положительным числом.");
  }
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== user.id) return null;
  const stockRecords = store.aquariumStock.get(aquariumId) ?? [];
  const record = stockRecords.find((item) => item.id === stockId);
  if (!record) return null;
  record.quantity = quantity;
  record.updatedAt = new Date().toISOString();
  store.aquariumStock.set(aquariumId, stockRecords);
  recalculateAquariumInsights(aquarium, user);
  return getAquarium(user.id, aquariumId);
};

export const removeFishFromAquarium = (
  user: User,
  aquariumId: string,
  stockId: string,
): AquariumWithDetails | null => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== user.id) return null;
  const stockRecords = store.aquariumStock.get(aquariumId) ?? [];
  const filtered = stockRecords.filter((item) => item.id !== stockId);
  store.aquariumStock.set(aquariumId, filtered);
  recalculateAquariumInsights(aquarium, user);
  return getAquarium(user.id, aquariumId);
};

export const markTaskComplete = (
  user: User,
  aquariumId: string,
  taskId: string,
  measurements?: Record<string, number>,
): CareTask | null => {
  const store = getStore();
  const aquarium = store.aquariums.get(aquariumId);
  if (!aquarium || aquarium.userId !== user.id) return null;
  const tasks = store.careTasks.get(aquariumId) ?? [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return null;
  const now = new Date();
  const nextDue = addDays(now, task.intervalDays);
  const updated: CareTask = {
    ...task,
    status: "completed",
    lastCompletedAt: now.toISOString(),
    nextDueAt: nextDue.toISOString(),
    updatedAt: now.toISOString(),
    parameters: task.requiresMeasurement
      ? task.parameters?.map((parameter) => ({
          ...parameter,
          value: measurements?.[parameter.parameter] ?? parameter.value,
        }))
      : task.parameters,
  };
  const index = tasks.findIndex((item) => item.id === taskId);
  tasks[index] = updated;
  store.careTasks.set(aquariumId, tasks);
  return updated;
};

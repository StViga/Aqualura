import {
  addDays,
  differenceInCalendarDays,
  isAfter,
} from "date-fns";

import crypto from "node:crypto";

import {
  Aquarium,
  AquariumInsights,
  AquariumStatusLevel,
  AquariumStock,
  BioLoadSummary,
  CareTask,
  CareTaskType,
  NotificationChannel,
  NotificationPreferenceTime,
  User,
  WaterParameterKey,
} from "@/domain/types";
import { behaviorMatrix } from "@/data/fishSpecies";
import { findFish, getStore } from "@/lib/store";

interface BaseTaskTemplate {
  type: CareTaskType;
  title: string;
  description: string;
  requiresMeasurement: boolean;
  measurementKeys?: WaterParameterKey[];
}

interface IntervalProfile {
  water_change: number;
  feeding: number;
  observe: number;
  test_no3: number;
  test_no2: number;
  test_ph: number;
  test_gh: number;
  test_kh: number;
  test_ta: number;
  test_cl2: number;
}

const baseTasks: BaseTaskTemplate[] = [
  {
    type: "feeding",
    title: "Кормление рыб",
    description:
      "Кормите рыб небольшими порциями, которые они успевают съесть за две-три минуты.",
    requiresMeasurement: false,
  },
  {
    type: "observe",
    title: "Наблюдение за поведением",
    description:
      "Проверьте активность, аппетит и отсутствие признаков стресса у обитателей.",
    requiresMeasurement: false,
  },
  {
    type: "water_change",
    title: "Частичная подмена воды",
    description:
      "Замените часть воды на подготовленную свежую, не забывая про кондиционер и подогрев.",
    requiresMeasurement: false,
  },
  {
    type: "test_no3",
    title: "Тест на нитраты (NO3)",
    description: "Измерьте уровень нитратов и зафиксируйте результат.",
    requiresMeasurement: true,
    measurementKeys: ["NO3"],
  },
  {
    type: "test_no2",
    title: "Тест на нитриты (NO2)",
    description: "Проверьте наличие нитритов и убедитесь, что значение близко к нулю.",
    requiresMeasurement: true,
    measurementKeys: ["NO2"],
  },
  {
    type: "test_ph",
    title: "Тест на pH",
    description: "Проверьте кислотность воды и убедитесь, что значение в рабочем диапазоне.",
    requiresMeasurement: true,
    measurementKeys: ["pH"],
  },
  {
    type: "test_gh",
    title: "Тест на общую жесткость (GH)",
    description: "Запишите показатель общей жесткости и сравните с целевым.",
    requiresMeasurement: true,
    measurementKeys: ["GH"],
  },
  {
    type: "test_kh",
    title: "Тест на карбонатную жесткость (KH)",
    description: "Контролируйте буферную емкость воды, особенно в растительных аквариумах.",
    requiresMeasurement: true,
    measurementKeys: ["KH"],
  },
  {
    type: "test_ta",
    title: "Тест на щелочность (TA)",
    description: "Проверьте щелочность, чтобы своевременно корректировать параметры.",
    requiresMeasurement: true,
    measurementKeys: ["TA"],
  },
  {
    type: "test_cl2",
    title: "Тест на хлор (Cl2)",
    description: "Убедитесь, что в воде отсутствует свободный хлор перед подменами.",
    requiresMeasurement: true,
    measurementKeys: ["Cl2"],
  },
];

const intervalMatrix: Record<AquariumStatusLevel, IntervalProfile> = {
  comfort: {
    water_change: 14,
    feeding: 1,
    observe: 1,
    test_no3: 14,
    test_no2: 14,
    test_ph: 14,
    test_gh: 28,
    test_kh: 21,
    test_ta: 21,
    test_cl2: 30,
  },
  elevated: {
    water_change: 7,
    feeding: 1,
    observe: 1,
    test_no3: 7,
    test_no2: 7,
    test_ph: 7,
    test_gh: 21,
    test_kh: 14,
    test_ta: 14,
    test_cl2: 21,
  },
  critical: {
    water_change: 3,
    feeding: 1,
    observe: 1,
    test_no3: 3,
    test_no2: 3,
    test_ph: 3,
    test_gh: 7,
    test_kh: 7,
    test_ta: 7,
    test_cl2: 10,
  },
};

const preferredHour = (preference: NotificationPreferenceTime): number => {
  switch (preference) {
    case "morning":
      return 9;
    case "evening":
      return 19;
    default:
      return 12;
  }
};

const normalizeDueDate = (
  offsetDays: number,
  preference: NotificationPreferenceTime,
): string => {
  const target = addDays(new Date(), offsetDays);
  target.setUTCHours(preferredHour(preference), 0, 0, 0);
  return target.toISOString();
};

const updateTaskStatus = (task: CareTask): CareTask => {
  const now = new Date();
  const due = new Date(task.nextDueAt);
  if (task.status === "completed") {
    const daysSince = differenceInCalendarDays(now, due);
    if (daysSince >= task.intervalDays) {
      const next = addDays(due, task.intervalDays);
      return {
        ...task,
        status: "active",
        nextDueAt: next.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return task;
  }
  if (isAfter(now, due) && task.status !== "overdue") {
    return {
      ...task,
      status: "overdue",
      updatedAt: new Date().toISOString(),
    };
  }
  if (!isAfter(now, due) && task.status === "overdue") {
    return {
      ...task,
      status: "active",
      updatedAt: new Date().toISOString(),
    };
  }
  return task;
};

const mergeCareTasks = (
  aquarium: Aquarium,
  user: User,
  desiredStatus: AquariumStatusLevel,
): CareTask[] => {
  const store = getStore();
  const existing = store.careTasks.get(aquarium.id) ?? [];
  const updatedAt = new Date().toISOString();
  const preference = user.notificationSettings.preferredTime;
  const channel: NotificationChannel = user.notificationSettings.channel;
  const intervals = intervalMatrix[desiredStatus];

  const nextTasks: CareTask[] = baseTasks.map((template) => {
    const existingTask = existing.find((task) => task.type === template.type);
    const intervalDays = intervals[template.type];
    const taskChannel: NotificationChannel =
      template.type === "feeding" && user.notificationSettings.muteFeedingReminders
        ? "off"
        : channel;
    if (existingTask) {
      const adjusted: CareTask = {
        ...existingTask,
        title: template.title,
        description: template.description,
        requiresMeasurement: template.requiresMeasurement,
        intervalDays,
        channel: taskChannel,
        updatedAt,
      };
      return updateTaskStatus(adjusted);
    }
    const nextDueAt = normalizeDueDate(
      template.type === "feeding" || template.type === "observe" ? 0 : 1,
      preference,
    );
    return {
      id: crypto.randomUUID(),
      aquariumId: aquarium.id,
      type: template.type,
      title: template.title,
      description: template.description,
      intervalDays,
      nextDueAt,
      status: "active",
      channel: taskChannel,
      requiresMeasurement: template.requiresMeasurement,
      parameters: template.measurementKeys?.map((parameter) => ({
        parameter,
        value: 0,
      })),
      createdAt: updatedAt,
      updatedAt,
    } satisfies CareTask;
  });

  return nextTasks.map(updateTaskStatus);
};

const summarizeBioLoad = (
  aquarium: Aquarium,
  stock: AquariumStock[],
): BioLoadSummary => {
  const store = getStore();
  let requiredVolume = 0;
  stock.forEach((record) => {
    const species = store.fishSpecies.get(record.speciesId);
    if (!species) return;
    requiredVolume += record.quantity * species.recommendedVolumePerFish;
  });

  const percentage = aquarium.volumeLiters === 0
    ? 0
    : Math.round((requiredVolume / aquarium.volumeLiters) * 100);

  let status: AquariumStatusLevel = "comfort";
  if (percentage > 100) {
    status = "critical";
  } else if (percentage > 60) {
    status = "elevated";
  }

  return {
    requiredVolumeLiters: Number(requiredVolume.toFixed(1)),
    percentage,
    status,
  };
};

const evaluateCompatibility = (
  stock: AquariumStock[],
): AquariumInsights["compatibility"] => {
  const warnings: AquariumInsights["compatibility"]["warnings"] = [];

  for (let i = 0; i < stock.length; i += 1) {
    for (let j = i + 1; j < stock.length; j += 1) {
      const first = stock[i];
      const second = stock[j];
      const speciesA = findFish(first.speciesId);
      const speciesB = findFish(second.speciesId);
      if (!speciesA || !speciesB) continue;
      const behaviorA = behaviorMatrix[speciesA.behavior];
      const behaviorB = behaviorMatrix[speciesB.behavior];

      if (behaviorA.incompatibleWith.includes(speciesB.behavior)) {
        warnings.push({
          speciesAId: speciesA.id,
          speciesBId: speciesB.id,
          message: `${speciesA.commonName} и ${speciesB.commonName} часто конфликтуют из-за несовместимого поведения.`,
        });
        continue;
      }
      if (behaviorB.incompatibleWith.includes(speciesA.behavior)) {
        warnings.push({
          speciesAId: speciesA.id,
          speciesBId: speciesB.id,
          message: `${speciesB.commonName} и ${speciesA.commonName} имеют выраженный конфликт интересов.`,
        });
        continue;
      }

      const cautionMessage = (actor: string, subject: string) =>
        `${actor} и ${subject} требуют наблюдения: возможны стычки при нехватке объема или укрытий.`;

      if (behaviorA.cautionWith?.includes(speciesB.behavior)) {
        warnings.push({
          speciesAId: speciesA.id,
          speciesBId: speciesB.id,
          message: cautionMessage(speciesA.commonName, speciesB.commonName),
        });
      } else if (behaviorB.cautionWith?.includes(speciesA.behavior)) {
        warnings.push({
          speciesAId: speciesA.id,
          speciesBId: speciesB.id,
          message: cautionMessage(speciesB.commonName, speciesA.commonName),
        });
      }
    }
  }

  return {
    status: warnings.length === 0 ? "ok" : "warn",
    warnings,
  };
};

export const recalculateAquariumInsights = (
  aquarium: Aquarium,
  user: User,
): CareTask[] => {
  const store = getStore();
  const stock = store.aquariumStock.get(aquarium.id) ?? [];
  const bioLoad = summarizeBioLoad(aquarium, stock);
  const compatibility = evaluateCompatibility(stock);

  const updatedAquarium: Aquarium = {
    ...aquarium,
    status: bioLoad.status,
    bioLoadPercentage: bioLoad.percentage,
    requiredVolumeLiters: bioLoad.requiredVolumeLiters,
    compatibilityStatus: compatibility.status,
    warnings: compatibility.warnings,
    lastCalculatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.aquariums.set(updatedAquarium.id, updatedAquarium);

  let tasks: CareTask[] = [];
  if (stock.length > 0) {
    tasks = mergeCareTasks(updatedAquarium, user, bioLoad.status);
    store.careTasks.set(updatedAquarium.id, tasks);
  } else {
    store.careTasks.set(updatedAquarium.id, []);
  }
  return tasks;
};

export const buildAquariumInsights = (
  aquarium: Aquarium,
): AquariumInsights => {
  const store = getStore();
  const stock = store.aquariumStock.get(aquarium.id) ?? [];
  const bioLoad = summarizeBioLoad(aquarium, stock);
  const compatibility = evaluateCompatibility(stock);
  return {
    bioLoad,
    compatibility,
  };
};

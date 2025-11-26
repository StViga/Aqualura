export type NotificationChannel = "email" | "push" | "off";
export type NotificationPreferenceTime = "morning" | "evening" | "any";

export type AquariumStatusLevel = "comfort" | "elevated" | "critical";
export type CompatibilityStatus = "ok" | "warn";

export type CareTaskStatus = "active" | "completed" | "overdue";
export type CareTaskType =
  | "water_change"
  | "test_no3"
  | "test_no2"
  | "test_ph"
  | "test_gh"
  | "test_kh"
  | "test_ta"
  | "test_cl2"
  | "feeding"
  | "observe";

export type FishBehaviorCategory =
  | "peaceful"
  | "semi_aggressive"
  | "aggressive"
  | "predator"
  | "bottom_dweller"
  | "schooling";

export type FishSizeClass = "juvenile" | "medium" | "large";

export type WaterParameterKey =
  | "NO3"
  | "NO2"
  | "Cl2"
  | "GH"
  | "TA"
  | "KH"
  | "pH";

export interface NotificationSettings {
  channel: NotificationChannel;
  preferredTime: NotificationPreferenceTime;
  timeZone: string;
  muteFeedingReminders?: boolean;
}

export interface Subscription {
  plan: "free" | "premium";
  startAt: string;
  endAt?: string;
  aquariumLimit: number;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  notificationSettings: NotificationSettings;
  subscription: Subscription;
  createdAt: string;
  updatedAt: string;
}

export interface Aquarium {
  id: string;
  userId: string;
  name: string;
  volumeLiters: number;
  description?: string;
  type: "freshwater";
  isPublic: boolean;
  status: AquariumStatusLevel;
  compatibilityStatus: CompatibilityStatus;
  bioLoadPercentage: number;
  requiredVolumeLiters: number;
  warnings: CompatibilityWarning[];
  lastCalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FishSpecies {
  id: string;
  commonName: string;
  scientificName: string;
  recommendedVolumePerFish: number;
  behavior: FishBehaviorCategory;
  bioLoadFactor: number;
  isSchooling: boolean;
  notes?: string;
}

export interface AquariumStock {
  id: string;
  aquariumId: string;
  speciesId: string;
  quantity: number;
  sizeClass?: FishSizeClass;
  createdAt: string;
  updatedAt: string;
}

export interface CompatibilityWarning {
  speciesAId: string;
  speciesBId: string;
  message: string;
}

export interface BioLoadSummary {
  requiredVolumeLiters: number;
  percentage: number;
  status: AquariumStatusLevel;
}

export interface AquariumInsights {
  bioLoad: BioLoadSummary;
  compatibility: {
    status: CompatibilityStatus;
    warnings: CompatibilityWarning[];
  };
}

export interface CareTask {
  id: string;
  aquariumId: string;
  type: CareTaskType;
  title: string;
  description: string;
  intervalDays: number;
  nextDueAt: string;
  lastCompletedAt?: string;
  status: CareTaskStatus;
  channel: NotificationChannel;
  requiresMeasurement: boolean;
  parameters?: TaskMeasurementValue[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskMeasurementValue {
  parameter: WaterParameterKey;
  value: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AquariumWithDetails extends Aquarium {
  species: Array<{
    stock: AquariumStock;
    fish: FishSpecies;
  }>;
  careTasks: CareTask[];
}

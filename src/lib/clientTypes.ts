export interface NotificationSettingsDTO {
  channel: "email" | "push" | "off";
  preferredTime: "morning" | "evening" | "any";
  timeZone: string;
  muteFeedingReminders?: boolean;
}

export interface SubscriptionDTO {
  plan: "free" | "premium";
  startAt: string;
  endAt?: string;
  aquariumLimit: number;
}

export interface UserDTO {
  id: string;
  email: string;
  displayName?: string;
  notificationSettings: NotificationSettingsDTO;
  subscription: SubscriptionDTO;
  createdAt: string;
  updatedAt: string;
}

export interface AquariumSpeciesDTO {
  id: string;
  speciesId: string;
  commonName: string;
  scientificName: string;
  quantity: number;
  sizeClass?: "juvenile" | "medium" | "large";
  recommendedVolumePerFish: number;
  behavior:
    | "peaceful"
    | "semi_aggressive"
    | "aggressive"
    | "predator"
    | "bottom_dweller"
    | "schooling";
  bioLoadFactor: number;
  isSchooling: boolean;
  notes?: string;
}

export interface CompatibilityWarningDTO {
  speciesA: { id: string; name: string };
  speciesB: { id: string; name: string };
  message: string;
}

export interface CareTaskDTO {
  id: string;
  aquariumId: string;
  type:
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
  title: string;
  description: string;
  intervalDays: number;
  nextDueAt: string;
  lastCompletedAt?: string;
  status: "active" | "completed" | "overdue";
  channel: "email" | "push" | "off";
  requiresMeasurement: boolean;
  parameters?: Array<{ parameter: string; value: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface AquariumDTO {
  id: string;
  name: string;
  volumeLiters: number;
  description?: string;
  status: "comfort" | "elevated" | "critical";
  compatibilityStatus: "ok" | "warn";
  bioLoadPercentage: number;
  requiredVolumeLiters: number;
  warnings: Array<{
    speciesAId: string;
    speciesBId: string;
    message: string;
  }>;
  lastCalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
  species: AquariumSpeciesDTO[];
  careTasks: CareTaskDTO[];
}

export interface FishSpeciesDTO {
  id: string;
  commonName: string;
  scientificName: string;
  behavior: AquariumSpeciesDTO["behavior"];
  bioLoadFactor: number;
  recommendedVolumePerFish: number;
  isSchooling: boolean;
  notes?: string;
}

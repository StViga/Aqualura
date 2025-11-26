import {
  AquariumWithDetails,
  CareTask,
  CompatibilityWarning,
  FishSpecies,
  User,
} from "@/domain/types";
import { findFish } from "@/lib/store";

export const userToDto = (user: User) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  notificationSettings: user.notificationSettings,
  subscription: user.subscription,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const aquariumToDto = (aquarium: AquariumWithDetails) => ({
  id: aquarium.id,
  name: aquarium.name,
  volumeLiters: aquarium.volumeLiters,
  description: aquarium.description,
  status: aquarium.status,
  compatibilityStatus: aquarium.compatibilityStatus,
  bioLoadPercentage: aquarium.bioLoadPercentage,
  requiredVolumeLiters: aquarium.requiredVolumeLiters,
  warnings: aquarium.warnings,
  lastCalculatedAt: aquarium.lastCalculatedAt,
  createdAt: aquarium.createdAt,
  updatedAt: aquarium.updatedAt,
  species: aquarium.species.map((entry) => ({
    id: entry.stock.id,
    speciesId: entry.fish.id,
    commonName: entry.fish.commonName,
    scientificName: entry.fish.scientificName,
    quantity: entry.stock.quantity,
    sizeClass: entry.stock.sizeClass,
    recommendedVolumePerFish: entry.fish.recommendedVolumePerFish,
    behavior: entry.fish.behavior,
    bioLoadFactor: entry.fish.bioLoadFactor,
    isSchooling: entry.fish.isSchooling,
    notes: entry.fish.notes,
  })),
  careTasks: aquarium.careTasks,
});

export const careTaskToDto = (task: CareTask) => task;

export const compatibilityWarningsToDto = (
  warnings: CompatibilityWarning[],
) => warnings.map((warning) => {
  const speciesA = findFish(warning.speciesAId);
  const speciesB = findFish(warning.speciesBId);
  return {
    speciesA: speciesA
      ? { id: speciesA.id, name: speciesA.commonName }
      : { id: warning.speciesAId, name: "Неизвестно" },
    speciesB: speciesB
      ? { id: speciesB.id, name: speciesB.commonName }
      : { id: warning.speciesBId, name: "Неизвестно" },
    message: warning.message,
  };
});

export const fishSpeciesToDto = (fish: FishSpecies) => ({
  id: fish.id,
  commonName: fish.commonName,
  scientificName: fish.scientificName,
  behavior: fish.behavior,
  bioLoadFactor: fish.bioLoadFactor,
  recommendedVolumePerFish: fish.recommendedVolumePerFish,
  isSchooling: fish.isSchooling,
  notes: fish.notes,
});

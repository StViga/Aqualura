import {
  Aquarium,
  AquariumStock,
  AquariumWithDetails,
  CareTask,
  Session,
  User,
} from "@/domain/types";
import { fishSpeciesCatalog } from "@/data/fishSpecies";
import { FishSpecies } from "@/domain/types";

interface DataStore {
  users: Map<string, User>;
  aquariums: Map<string, Aquarium>;
  aquariumStock: Map<string, AquariumStock[]>;
  careTasks: Map<string, CareTask[]>;
  sessions: Map<string, Session>;
  fishSpecies: Map<string, FishSpecies>;
}

const storeSymbol = Symbol.for("aquarium.guardian.store");

const createInitialStore = (): DataStore => {
  const fishSpeciesMap = new Map<string, FishSpecies>();
  fishSpeciesCatalog.forEach((species) => fishSpeciesMap.set(species.id, species));
  return {
    users: new Map(),
    aquariums: new Map(),
    aquariumStock: new Map(),
    careTasks: new Map(),
    sessions: new Map(),
    fishSpecies: fishSpeciesMap,
  };
};

const getGlobalStore = (): DataStore => {
  const globalScope = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  if (!globalScope[storeSymbol]) {
    globalScope[storeSymbol] = createInitialStore();
  }
  return globalScope[storeSymbol] as DataStore;
};

export const getStore = (): DataStore => getGlobalStore();

export const getFishSpecies = (): FishSpecies[] => {
  return Array.from(getStore().fishSpecies.values());
};

export const findFish = (speciesId: string): FishSpecies | undefined => {
  return getStore().fishSpecies.get(speciesId);
};

export const getUserAquariums = (userId: string): AquariumWithDetails[] => {
  const store = getStore();
  const aquariums = Array.from(store.aquariums.values()).filter(
    (a) => a.userId === userId,
  );
  return aquariums.map((aquarium) => {
    const stock = store.aquariumStock.get(aquarium.id) ?? [];
    const careTasks = store.careTasks.get(aquarium.id) ?? [];
    return {
      ...aquarium,
      species: stock.map((record) => ({
        stock: record,
        fish: store.fishSpecies.get(record.speciesId)!,
      })),
      careTasks,
    };
  });
};

export const resetStore = () => {
  const globalScope = globalThis as typeof globalThis & {
    [key: symbol]: unknown;
  };
  globalScope[storeSymbol] = createInitialStore();
};

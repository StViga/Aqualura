import { FishBehaviorCategory, FishSpecies } from "@/domain/types";

interface BehaviorProfile {
  incompatibleWith: FishBehaviorCategory[];
  cautionWith?: FishBehaviorCategory[];
  description: string;
}

export const behaviorMatrix: Record<FishBehaviorCategory, BehaviorProfile> = {
  peaceful: {
    incompatibleWith: ["aggressive", "predator"],
    cautionWith: ["semi_aggressive"],
    description:
      "Мирные рыбы комфортно сосуществуют с аналогичными по размеру видами и не терпят агрессивных соседей.",
  },
  semi_aggressive: {
    incompatibleWith: ["predator"],
    cautionWith: ["peaceful", "schooling"],
    description:
      "Полуагрессивные виды требуют внимания к объему и укрытиям, чтобы снизить риск территориальных конфликтов.",
  },
  aggressive: {
    incompatibleWith: ["peaceful", "schooling", "bottom_dweller"],
    cautionWith: ["semi_aggressive"],
    description:
      "Агрессивные виды доминируют и могут травмировать более спокойных рыб, особенно в тесных аквариумах.",
  },
  predator: {
    incompatibleWith: ["peaceful", "schooling", "bottom_dweller"],
    cautionWith: ["semi_aggressive"],
    description:
      "Хищники воспринимают мелких рыб как потенциальный корм и требуют простор и устойчивый рацион.",
  },
  bottom_dweller: {
    incompatibleWith: [],
    cautionWith: ["aggressive", "predator"],
    description:
      "Донные жители уживаются с большинством видов, если им обеспечен доступ к корму и укрытия.",
  },
  schooling: {
    incompatibleWith: ["aggressive", "predator"],
    cautionWith: ["semi_aggressive"],
    description:
      "Стайные рыбы чувствуют себя уверенно в группе и требуют спокойных соседей без ярко выраженной территориальности.",
  },
};

export const fishSpeciesCatalog: FishSpecies[] = [
  {
    id: "neon_tetra",
    commonName: "Неон",
    scientificName: "Paracheirodon innesi",
    recommendedVolumePerFish: 4,
    behavior: "schooling",
    bioLoadFactor: 1,
    isSchooling: true,
    notes: "Стайная мирная рыба, предпочитает мягкую и слегка кисловатую воду.",
  },
  {
    id: "guppy",
    commonName: "Гуппи",
    scientificName: "Poecilia reticulata",
    recommendedVolumePerFish: 5,
    behavior: "peaceful",
    bioLoadFactor: 1,
    isSchooling: true,
    notes: "Неприхотливы, но склонны к быстрому размножению.",
  },
  {
    id: "angelfish",
    commonName: "Скалярия",
    scientificName: "Pterophyllum scalare",
    recommendedVolumePerFish: 20,
    behavior: "semi_aggressive",
    bioLoadFactor: 2,
    isSchooling: false,
    notes:
      "При нехватке объема могут проявлять территориальность, особенно к мелким стайным рыбам.",
  },
  {
    id: "betta",
    commonName: "Петушок",
    scientificName: "Betta splendens",
    recommendedVolumePerFish: 15,
    behavior: "aggressive",
    bioLoadFactor: 1.5,
    isSchooling: false,
    notes: "Самцы агрессивны к себе подобным и предпочитают одиночное содержание.",
  },
  {
    id: "corydoras",
    commonName: "Коридорас",
    scientificName: "Corydoras paleatus",
    recommendedVolumePerFish: 8,
    behavior: "bottom_dweller",
    bioLoadFactor: 1,
    isSchooling: true,
    notes: "Донные санитары, лучше содержать группой от шести особей.",
  },
  {
    id: "discus",
    commonName: "Дискус",
    scientificName: "Symphysodon aequifasciatus",
    recommendedVolumePerFish: 40,
    behavior: "peaceful",
    bioLoadFactor: 3,
    isSchooling: true,
    notes:
      "Требовательны к качеству воды, предпочитают теплую и мягкую среду. Нуждаются в просторном аквариуме.",
  },
  {
    id: "oscar",
    commonName: "Оскар",
    scientificName: "Astronotus ocellatus",
    recommendedVolumePerFish: 100,
    behavior: "predator",
    bioLoadFactor: 4,
    isSchooling: false,
    notes:
      "Крупный хищник, воспринимает мелких рыб как корм. Требует мощной фильтрации и больших объемов.",
  },
  {
    id: "goldfish",
    commonName: "Золотая рыбка",
    scientificName: "Carassius auratus",
    recommendedVolumePerFish: 40,
    behavior: "peaceful",
    bioLoadFactor: 3,
    isSchooling: false,
    notes: "Высокая нагрузка на биофильтрацию, предпочитают прохладную воду.",
  },
  {
    id: "molly",
    commonName: "Моллинезия",
    scientificName: "Poecilia sphenops",
    recommendedVolumePerFish: 10,
    behavior: "peaceful",
    bioLoadFactor: 1.2,
    isSchooling: true,
    notes: "Требуют стабильных параметров воды и добавления соли в некоторых вариантах содержания.",
  },
  {
    id: "pleco",
    commonName: "Анциструс",
    scientificName: "Ancistrus dolichopterus",
    recommendedVolumePerFish: 20,
    behavior: "bottom_dweller",
    bioLoadFactor: 1.8,
    isSchooling: false,
    notes: "Донный сом, помогает контролировать обрастания, но выделяет много органики.",
  },
];

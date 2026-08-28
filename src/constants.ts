import type { MacroKey } from "./types/domain";

export const dayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export interface MacroDefinition {
  key: MacroKey;
  label: string;
  unit: string;
}

export const macroDefinitions: readonly MacroDefinition[] = [
  { key: "calories", label: "Calorías", unit: "kcal" },
  { key: "protein", label: "Proteína", unit: "g" },
  { key: "carbs", label: "Carbohidratos", unit: "g" },
  { key: "fats", label: "Grasas", unit: "g" },
];

export const format = (value: number | string | null | undefined): string =>
  Number(value || 0).toFixed(1);
export const slotLabel = (slot: number): string =>
  `${String(Math.floor((slot * 30) / 60)).padStart(2, "0")}:${String((slot * 30) % 60).padStart(2, "0")}`;
export const normalizeSearchText = (value: unknown): string =>
  String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");

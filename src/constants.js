export const dayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export const macroDefinitions = [
  { key: "calories", label: "Calorías", unit: "kcal" },
  { key: "protein", label: "Proteína", unit: "g" },
  { key: "carbs", label: "Carbohidratos", unit: "g" },
  { key: "fats", label: "Grasas", unit: "g" },
];

export const format = (value) => Number(value || 0).toFixed(1);
export const slotLabel = (slot) =>
  `${String(Math.floor((slot * 30) / 60)).padStart(2, "0")}:${String((slot * 30) % 60).padStart(2, "0")}`;
export const normalizeSearchText = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");

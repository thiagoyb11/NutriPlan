export type MacroKey = "calories" | "protein" | "carbs" | "fats";
export type ViewName =
  | "dashboard"
  | "recipes"
  | "ingredients"
  | "plan"
  | "settings";
export type ToastType = "error" | "success";

export interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Ingredient extends Nutrients {
  id: number;
  name: string;
}

export interface Recipe extends Nutrients {
  id: number;
  name: string;
  image_path: string;
}

export interface RecipeIngredient {
  id: number;
  cant: number;
}

export interface SelectedIngredient extends Ingredient {
  amount: number | string;
}

export interface MealSlot extends Nutrients {
  day: number;
  slot: number;
  recipe_id: number;
  name: string;
}

export interface ShoppingItem {
  ingredient_id: number;
  name: string;
  amount: number;
}

export type MacroGoals = Nutrients;

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export type Notify = (value: unknown, type?: ToastType) => void;

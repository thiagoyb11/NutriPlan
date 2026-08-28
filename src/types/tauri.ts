import type {
  Ingredient,
  MacroGoals,
  MealSlot,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
} from "./domain";

interface RecipePayload {
  name: string;
  img: string;
  ids: number[];
  quant: number[];
}

export interface TauriCommands {
  get_ing_rec: { args: { id: number }; result: RecipeIngredient[] };
  get_ingredients: { args: undefined; result: Ingredient[] };
  save_ingredient: {
    args: Omit<Ingredient, "id">;
    result: Ingredient;
  };
  get_recipes: { args: undefined; result: Recipe[] };
  save_image: { args: { sourcePath: string }; result: string };
  save_recipe: { args: RecipePayload; result: number };
  update_recipe: { args: RecipePayload & { id: number }; result: void };
  delete_recipe: { args: { id: number }; result: void };
  get_meals: { args: undefined; result: MealSlot[] };
  save_meal: {
    args: { day: number; slot: number; recipeId: number };
    result: void;
  };
  delete_meal: { args: { day: number; slot: number }; result: void };
  get_shopping_list: { args: undefined; result: ShoppingItem[] };
  get_macro_goals: { args: undefined; result: MacroGoals };
  save_macro_goals: { args: MacroGoals; result: void };
}

export type TauriCommand = keyof TauriCommands;
export type NoArgTauriCommand = {
  [C in TauriCommand]: TauriCommands[C]["args"] extends undefined ? C : never;
}[TauriCommand];
export type ArgTauriCommand = Exclude<TauriCommand, NoArgTauriCommand>;

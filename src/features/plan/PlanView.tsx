import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import { dayNames, format, slotLabel } from "../../constants";
import { invoke } from "../../services/tauri";
import type {
  Ingredient,
  MealSlot,
  Notify,
  RecipeIngredient,
} from "../../types/domain";
import MealForm from "./MealForm";
import ShoppingList from "./ShoppingList";

interface PlanData {
  meals: MealSlot[];
  ingredientById: Map<number, Ingredient>;
  recipeIngredients: Map<number, RecipeIngredient[]>;
}
type PlanModal =
  | { type: "shopping" }
  | { type: "meal"; day: number; slot: number; meal: MealSlot | null }
  | null;

export default function PlanView({ notify }: { notify: Notify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<PlanData | null>(null);
  const [modal, setModal] = useState<PlanModal>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    Promise.all([invoke("get_meals"), invoke("get_ingredients")])
      .then(async ([meals, ingredients]) => {
        const ids = [...new Set(meals.map((meal) => meal.recipe_id))];
        const amounts = await Promise.all(
          ids.map(
            async (id): Promise<[number, RecipeIngredient[]]> => [
              id,
              await invoke("get_ing_rec", { id }),
            ],
          ),
        );
        if (current)
          setData({
            meals,
            ingredientById: new Map(ingredients.map((item) => [item.id, item])),
            recipeIngredients: new Map(amounts),
          });
      })
      .catch(notify);
    return () => {
      current = false;
    };
  }, [refreshKey, notify]);

  if (!data) return <Loading />;
  const mealBySlot = new Map(
    data.meals.map((meal): [string, MealSlot] => [
      `${meal.day}-${meal.slot}`,
      meal,
    ]),
  );

  return (
    <>
      <div className="plan-heading">
        <h2>Plan semanal</h2>
        <button
          type="button"
          className="secondary"
          onClick={() => setModal({ type: "shopping" })}
        >
          Lista de compra
        </button>
      </div>
      <div className="plan-wrap">
        <table className="plan-table">
          <thead>
            <tr>
              <th />
              {dayNames.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 48 }, (_, slot) => (
              <tr key={slot}>
                <th>{slotLabel(slot)}</th>
                {dayNames.map((_, day) => {
                  const meal = mealBySlot.get(`${day}-${slot}`) ?? null;
                  const details = meal
                    ? (data.recipeIngredients.get(meal.recipe_id) ?? [])
                        .map((item) => {
                          const ingredient = data.ingredientById.get(item.id);
                          return ingredient
                            ? `${ingredient.name}: ${format(item.cant)} g`
                            : "";
                        })
                        .filter(Boolean)
                        .join("\n")
                    : "";
                  return (
                    <td
                      className="plan-cell"
                      key={day}
                      onClick={() =>
                        setModal({ type: "meal", day, slot, meal })
                      }
                    >
                      {meal && (
                        <span
                          className="meal-entry"
                          data-tooltip={details || "Sin ingredientes"}
                        >
                          {meal.name} ({Math.round(meal.calories)} kcal)
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal?.type === "meal" && (
        <MealForm
          {...modal}
          notify={notify}
          onClose={() => setModal(null)}
          onSaved={() => setRefreshKey((value) => value + 1)}
        />
      )}
      {modal?.type === "shopping" && (
        <ShoppingList notify={notify} onClose={() => setModal(null)} />
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import Modal from "../../components/Modal";
import { format, macroDefinitions } from "../../constants";
import { invoke } from "../../services/tauri";
import type { Notify, Recipe, SelectedIngredient } from "../../types/domain";

export default function RecipeInfo({
  recipe,
  onClose,
  notify,
}: {
  recipe: Recipe;
  onClose: () => void;
  notify: Notify;
}) {
  const [rows, setRows] = useState<SelectedIngredient[] | null>(null);
  useEffect(() => {
    Promise.all([
      invoke("get_ing_rec", { id: recipe.id }),
      invoke("get_ingredients"),
    ])
      .then(([items, ingredients]) => {
        const byId = new Map(ingredients.map((item) => [item.id, item]));
        setRows(
          items.flatMap((item) => {
            const ingredient = byId.get(item.id);
            return ingredient
              ? [{ ...ingredient, amount: Number(item.cant) }]
              : [];
          }),
        );
      })
      .catch(notify);
  }, [recipe, notify]);

  const totals = rows?.reduce(
    (sum, item) => {
      const amount = Number(item.amount);
      sum.amount += amount;
      macroDefinitions.forEach(({ key }) => {
        sum[key] += (Number(item[key]) * amount) / 100;
      });
      return sum;
    },
    { amount: 0, calories: 0, protein: 0, carbs: 0, fats: 0 },
  ) ?? { amount: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };

  return (
    <Modal title="Valor nutricional" size="wide" onClose={onClose}>
      <p className="modal-subtitle">{recipe.name}</p>
      {!rows ? (
        <Loading />
      ) : (
        <div className="table-scroll">
          <table className="nutrition-table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Cantidad</th>
                <th>Calorías</th>
                <th>Proteína</th>
                <th>Carbohidratos</th>
                <th>Grasas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const amount = Number(item.amount);
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{format(amount)} g</td>
                    <td>{format((item.calories * amount) / 100)} kcal</td>
                    <td>{format((item.protein * amount) / 100)} g</td>
                    <td>{format((item.carbs * amount) / 100)} g</td>
                    <td>{format((item.fats * amount) / 100)} g</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Totales</td>
                <td>{format(totals.amount)} g</td>
                <td>{format(totals.calories)} kcal</td>
                <td>{format(totals.protein)} g</td>
                <td>{format(totals.carbs)} g</td>
                <td>{format(totals.fats)} g</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./components/Modal";
import Picker from "./components/Picker";
import ToastStack from "./components/ToastStack";
import {
  dayNames,
  format,
  macroDefinitions,
  normalizeSearchText,
  slotLabel,
} from "./constants";
import { convertFileSrc, invoke, openImage } from "./services/tauri";
import fallbackFood from "./assets/food.jpg";

const views = [
  ["dashboard", "Dashboard"],
  ["recipes", "Recetas"],
  ["ingredients", "Ingredientes"],
  ["plan", "Plan semanal"],
  ["settings", "Configuración"],
];

function useData(command, refreshKey = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true;
    setData(null);
    invoke(command)
      .then((value) => current && setData(value))
      .catch((reason) => current && setError(reason));
    return () => {
      current = false;
    };
  }, [command, refreshKey]);
  return { data, error };
}

function Loading() {
  return (
    <div className="loading-state" role="status">
      Cargando…
    </div>
  );
}

function SearchHeader({ query, onQuery, placeholder, action, actionLabel }) {
  return (
    <section className="hero">
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="button" onClick={action}>
        {actionLabel}
      </button>
    </section>
  );
}

function IngredientForm({ initialName = "", onClose, onSaved, notify }) {
  const [values, setValues] = useState({
    name: initialName,
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    const payload = {
      name: values.name.trim(),
      ...Object.fromEntries(
        macroDefinitions.map(({ key }) => [key, Number(values[key])]),
      ),
    };
    if (
      !payload.name ||
      macroDefinitions.some(
        ({ key }) => !Number.isFinite(payload[key]) || payload[key] < 0,
      )
    ) {
      notify("Completa un nombre y valores nutricionales válidos.");
      return;
    }
    try {
      setSaving(true);
      const ingredient = await invoke("save_ingredient", payload);
      onSaved(ingredient);
      notify("Ingrediente agregado.", "success");
      onClose();
    } catch (error) {
      notify(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Nuevo ingrediente" onClose={onClose}>
      <form onSubmit={save}>
        <input
          autoFocus
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="Nombre del ingrediente"
        />
        <div className="nutrition-fields">
          {macroDefinitions.map(({ key, label, unit }) => (
            <label key={key}>
              {label}
              {key !== "calories" ? ` (${unit})` : ""}
              <input
                type="number"
                min="0"
                step="0.1"
                value={values[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <button className="modal-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar ingrediente"}
        </button>
      </form>
    </Modal>
  );
}

function RecipeForm({ recipe, onClose, onSaved, notify }) {
  const [ingredients, setIngredients] = useState(null);
  const [name, setName] = useState(recipe?.name || "");
  const [imagePath, setImagePath] = useState(recipe?.image_path || "");
  const [selected, setSelected] = useState([]);
  const [newIngredientName, setNewIngredientName] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([
      invoke("get_ingredients"),
      recipe ? invoke("get_ing_rec", { id: recipe.id }) : [],
    ])
      .then(([all, amounts]) => {
        if (!current) return;
        setIngredients(all);
        const byId = new Map(all.map((item) => [item.id, item]));
        setSelected(
          amounts
            .map((item) => ({ ...byId.get(item.id), amount: item.cant }))
            .filter((item) => item.id),
        );
      })
      .catch(notify);
    return () => {
      current = false;
    };
  }, [recipe, notify]);

  const add = (item) =>
    setSelected((items) =>
      items.some(({ id }) => id === item.id)
        ? items
        : [...items, { ...item, amount: 100 }],
    );
  const chooseImage = async () => {
    try {
      const path = await openImage();
      if (path) setImagePath(await invoke("save_image", { sourcePath: path }));
    } catch (error) {
      notify(error);
    }
  };
  const save = async () => {
    const quantities = selected.map(({ amount }) => Number(amount));
    if (
      !name.trim() ||
      !selected.length ||
      quantities.some((amount) => !Number.isFinite(amount) || amount <= 0)
    ) {
      notify("Indica un nombre, ingredientes y cantidades válidas.");
      return;
    }
    const payload = {
      name: name.trim(),
      img: imagePath,
      ids: selected.map(({ id }) => id),
      quant: quantities,
    };
    try {
      setSaving(true);
      await invoke(
        recipe ? "update_recipe" : "save_recipe",
        recipe ? { ...payload, id: recipe.id } : payload,
      );
      notify("Receta guardada.", "success");
      onSaved();
      onClose();
    } catch (error) {
      notify(error);
      setSaving(false);
    }
  };

  if (!ingredients)
    return (
      <Modal
        title={recipe ? "Editar receta" : "Nueva receta"}
        onClose={onClose}
      >
        <Loading />
      </Modal>
    );
  return (
    <>
      <Modal
        title={recipe ? "Editar receta" : "Nueva receta"}
        onClose={onClose}
      >
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre de la receta"
        />
        <div className="inline-field">
          <input
            readOnly
            value={imagePath}
            placeholder="Sin imagen seleccionada"
          />
          <button type="button" className="secondary" onClick={chooseImage}>
            Elegir imagen
          </button>
        </div>
        <h3>Ingredientes</h3>
        <Picker
          items={ingredients}
          labelOf={(item) => item.name}
          onPick={add}
          placeholder="Buscar ingrediente…"
          renderEmpty={(query) => (
            <button
              type="button"
              className="choice picker-create"
              onClick={() => setNewIngredientName(query)}
            >
              + Agregar “{query}” como ingrediente
            </button>
          )}
        />
        <div className="selection-list">
          {selected.map((item) => (
            <div className="selected-row" key={item.id}>
              <span>{item.name}</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={item.amount}
                onChange={(event) =>
                  setSelected((items) =>
                    items.map((value) =>
                      value.id === item.id
                        ? { ...value, amount: event.target.value }
                        : value,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="danger"
                onClick={() =>
                  setSelected((items) =>
                    items.filter(({ id }) => id !== item.id),
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="modal-primary"
          disabled={saving}
          onClick={save}
        >
          {saving
            ? "Guardando…"
            : recipe
              ? "Guardar cambios"
              : "Guardar receta"}
        </button>
      </Modal>
      {newIngredientName !== null && (
        <IngredientForm
          initialName={newIngredientName}
          notify={notify}
          onClose={() => setNewIngredientName(null)}
          onSaved={(ingredient) => {
            setIngredients((items) => [...items, ingredient]);
            add(ingredient);
          }}
        />
      )}
    </>
  );
}

function RecipeInfo({ recipe, onClose, notify }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    Promise.all([
      invoke("get_ing_rec", { id: recipe.id }),
      invoke("get_ingredients"),
    ])
      .then(([items, ingredients]) => {
        const byId = new Map(ingredients.map((item) => [item.id, item]));
        setRows(
          items
            .map((item) => ({
              ...byId.get(item.id),
              amount: Number(item.cant),
            }))
            .filter((item) => item.id),
        );
      })
      .catch(notify);
  }, [recipe, notify]);
  const totals = rows?.reduce(
    (sum, item) => {
      sum.amount += item.amount;
      macroDefinitions.forEach(({ key }) => {
        sum[key] += (Number(item[key]) * item.amount) / 100;
      });
      return sum;
    },
    { amount: 0, calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
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
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{format(item.amount)} g</td>
                  <td>{format((item.calories * item.amount) / 100)} kcal</td>
                  <td>{format((item.protein * item.amount) / 100)} g</td>
                  <td>{format((item.carbs * item.amount) / 100)} g</td>
                  <td>{format((item.fats * item.amount) / 100)} g</td>
                </tr>
              ))}
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

function ConfirmDelete({ recipe, onClose, onDeleted, notify }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    try {
      setBusy(true);
      await invoke("delete_recipe", { id: recipe.id });
      notify("Receta eliminada.", "success");
      onDeleted();
      onClose();
    } catch (error) {
      notify(error);
      setBusy(false);
    }
  };
  return (
    <Modal title="Eliminar receta" onClose={onClose}>
      <p className="modal-confirmation">
        ¿Eliminar la receta “{recipe.name}”? También se quitará de los planes.
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={remove}
        >
          Eliminar
        </button>
      </div>
    </Modal>
  );
}

function RecipesView({ notify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: recipes, error } = useData("get_recipes", refreshKey);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  const filtered =
    recipes?.filter((recipe) =>
      normalizeSearchText(recipe.name).includes(normalizeSearchText(query)),
    ) || [];
  const refresh = () => setRefreshKey((value) => value + 1);
  return (
    <>
      <SearchHeader
        query={query}
        onQuery={setQuery}
        placeholder="Buscar recetas…"
        action={() => setModal({ type: "form" })}
        actionLabel="+ Agregar receta"
      />
      {!recipes ? (
        <Loading />
      ) : (
        <section className="grid">
          {filtered.map((recipe) => (
            <article className="card recipe-card" key={recipe.id}>
              <div
                className="recipe-image"
                style={{
                  backgroundImage: `url("${recipe.image_path ? convertFileSrc(recipe.image_path) : fallbackFood}")`,
                }}
              />
              <h3>{recipe.name}</h3>
              <p className="macros">
                Calorías: {format(recipe.calories)} kcal{"\n"}Proteína:{" "}
                {format(recipe.protein)} g{"\n"}Carbohidratos:{" "}
                {format(recipe.carbs)} g{"\n"}Grasas: {format(recipe.fats)} g
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  onClick={() => setModal({ type: "info", recipe })}
                >
                  Ver ingredientes
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: "form", recipe })}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setModal({ type: "delete", recipe })}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {modal?.type === "form" && (
        <RecipeForm
          recipe={modal.recipe}
          notify={notify}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
      {modal?.type === "info" && (
        <RecipeInfo
          recipe={modal.recipe}
          notify={notify}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <ConfirmDelete
          recipe={modal.recipe}
          notify={notify}
          onClose={() => setModal(null)}
          onDeleted={refresh}
        />
      )}
    </>
  );
}

function IngredientsView({ notify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: ingredients, error } = useData("get_ingredients", refreshKey);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  const filtered =
    ingredients?.filter((item) =>
      normalizeSearchText(item.name).includes(normalizeSearchText(query)),
    ) || [];
  return (
    <>
      <SearchHeader
        query={query}
        onQuery={setQuery}
        placeholder="Buscar ingredientes…"
        action={() => setOpen(true)}
        actionLabel="+ Agregar ingrediente"
      />
      {!ingredients ? (
        <Loading />
      ) : (
        <section className="grid">
          {filtered.map((item) => (
            <article className="card" key={item.id}>
              <h3>{item.name}</h3>
              <p className="macros">
                Por 100 g{"\n"}Calorías: {format(item.calories)} kcal{"\n"}
                Proteína: {format(item.protein)} g{"\n"}Carbohidratos:{" "}
                {format(item.carbs)} g{"\n"}Grasas: {format(item.fats)} g
              </p>
            </article>
          ))}
        </section>
      )}
      {open && (
        <IngredientForm
          notify={notify}
          onClose={() => setOpen(false)}
          onSaved={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </>
  );
}

function ProgressBar({ macro, amount, goal }) {
  const percent = goal > 0 ? (amount / goal) * 100 : 0;
  const state = percent < 50 ? "low" : percent < 80 ? "medium" : "good";
  return (
    <div className="macro-progress">
      <div className="macro-progress-label">
        <span>{macro.label}</span>
        <span>
          {goal > 0
            ? `${format(amount)} / ${format(goal)} ${macro.unit} · ${Math.round(percent)}%`
            : `${format(amount)} ${macro.unit} · sin objetivo`}
        </span>
      </div>
      <div
        className="macro-progress-track"
        role="progressbar"
        aria-label={`${macro.label}: ${Math.round(percent)}% del objetivo`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.min(Math.round(percent), 100)}
      >
        <div
          className={`macro-progress-fill ${state}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function DashboardView({ navigate, notify }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([invoke("get_meals"), invoke("get_macro_goals")])
      .then(([meals, goals]) => setData({ meals, goals }))
      .catch(notify);
  }, [notify]);
  if (!data) return <Loading />;
  return (
    <>
      <section className="dashboard-heading">
        <div>
          <h2>Dashboard semanal</h2>
          <p>Avance diario frente a tus objetivos de macronutrientes.</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => navigate("settings")}
        >
          Configurar objetivos
        </button>
      </section>
      <section className="dashboard-grid">
        {dayNames.map((dayName, day) => {
          const totals = data.meals
            .filter((meal) => meal.day === day)
            .reduce(
              (sum, meal) => {
                macroDefinitions.forEach(({ key }) => {
                  sum[key] += Number(meal[key]) || 0;
                });
                return sum;
              },
              { calories: 0, protein: 0, carbs: 0, fats: 0 },
            );
          return (
            <article className="dashboard-day" key={dayName}>
              <h3>{dayName}</h3>
              {macroDefinitions.map((macro) => (
                <ProgressBar
                  key={macro.key}
                  macro={macro}
                  amount={totals[macro.key]}
                  goal={Number(data.goals[macro.key]) || 0}
                />
              ))}
            </article>
          );
        })}
      </section>
    </>
  );
}

function SettingsView({ navigate, notify }) {
  const { data: goals, error } = useData("get_macro_goals");
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (goals) setValues(goals);
  }, [goals]);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  if (!values) return <Loading />;
  const save = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(
      macroDefinitions.map(({ key }) => [key, Number(values[key])]),
    );
    if (
      Object.values(payload).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    )
      return notify("Indica objetivos diarios válidos.");
    try {
      setSaving(true);
      await invoke("save_macro_goals", payload);
      notify("Objetivos guardados.", "success");
      navigate("dashboard");
    } catch (reason) {
      notify(reason);
      setSaving(false);
    }
  };
  return (
    <section className="settings-panel">
      <h2>Configuración</h2>
      <p>Personaliza cómo se evalúa tu planificación semanal.</p>
      <section className="settings-subsection">
        <h3>Objetivos diarios</h3>
        <p>Se aplican a todos los días del dashboard semanal.</p>
        <form className="goal-form" onSubmit={save}>
          {macroDefinitions.map((macro) => (
            <label key={macro.key}>
              {macro.label} diaria ({macro.unit})
              <input
                type="number"
                min="0"
                step="0.1"
                value={values[macro.key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [macro.key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          <button disabled={saving}>
            {saving ? "Guardando…" : "Guardar objetivos"}
          </button>
        </form>
      </section>
    </section>
  );
}

function MealForm({ day, slot, meal, onClose, onSaved, notify }) {
  const { data: recipes, error } = useData("get_recipes");
  const [selected, setSelected] = useState(meal || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  const save = async () => {
    if (!selected) return notify("Selecciona una receta.");
    try {
      setBusy(true);
      await invoke("save_meal", {
        day,
        slot,
        recipeId: selected.id || selected.recipe_id,
      });
      notify("Comida guardada.", "success");
      onSaved();
      onClose();
    } catch (reason) {
      notify(reason);
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      setBusy(true);
      await invoke("delete_meal", { day, slot });
      notify("Comida eliminada.", "success");
      onSaved();
      onClose();
    } catch (reason) {
      notify(reason);
      setBusy(false);
    }
  };
  return (
    <Modal title={`${dayNames[day]} · ${slotLabel(slot)}`} onClose={onClose}>
      <p className="modal-subtitle">
        Selecciona una receta para esta franja de 30 minutos.
      </p>
      {!recipes ? (
        <Loading />
      ) : (
        <>
          <Picker
            items={recipes}
            labelOf={(item) => item.name}
            onPick={setSelected}
            placeholder="Buscar receta…"
          />
          <div className="selection-list">
            {selected && (
              <div className="selected-row">
                <span>
                  {selected.name} · {Math.round(selected.calories)} kcal
                </span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setSelected(null)}
                >
                  Quitar
                </button>
              </div>
            )}
          </div>
          <div className="modal-actions">
            {meal && (
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={remove}
              >
                Eliminar comida
              </button>
            )}
            <button type="button" disabled={busy} onClick={save}>
              Guardar comida
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ShoppingList({ onClose, notify }) {
  const { data: items, error } = useData("get_shopping_list");
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  return (
    <Modal title="Lista de compra" onClose={onClose}>
      {!items ? (
        <Loading />
      ) : !items.length ? (
        <p className="modal-subtitle">
          Agrega recetas al plan semanal para generar la lista de compra.
        </p>
      ) : (
        <>
          <p className="modal-subtitle">
            Cantidades totales necesarias para todas las comidas planificadas.
          </p>
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={item.ingredient_id}>
                <span>{item.name}</span>
                <strong>{format(item.amount)} g</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function PlanView({ notify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    let current = true;
    setData(null);
    Promise.all([invoke("get_meals"), invoke("get_ingredients")])
      .then(async ([meals, ingredients]) => {
        const ids = [...new Set(meals.map((meal) => meal.recipe_id))];
        const amounts = await Promise.all(
          ids.map(async (id) => [id, await invoke("get_ing_rec", { id })]),
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
    data.meals.map((meal) => [`${meal.day}-${meal.slot}`, meal]),
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
              <>
                {dayNames.map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 48 }, (_, slot) => (
              <tr key={slot}>
                <th>{slotLabel(slot)}</th>
                {dayNames.map((_, day) => {
                  const meal = mealBySlot.get(`${day}-${slot}`) || null;
                  const details = meal
                    ? (data.recipeIngredients.get(meal.recipe_id) || [])
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

export default function App() {
  const [view, setView] = useState("recipes");
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((value, type = "error") => {
    const message =
      typeof value === "string"
        ? value
        : value?.message || "Ocurrió un error inesperado.";
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== id)),
      4200,
    );
  }, []);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>NutriPlan</h1>
        <nav aria-label="Navegación principal">
          {views.map(([key, label]) => (
            <button
              type="button"
              className={view === key ? "active" : ""}
              key={key}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main key={view}>
        {view === "dashboard" && (
          <DashboardView navigate={setView} notify={notify} />
        )}
        {view === "recipes" && <RecipesView notify={notify} />}
        {view === "ingredients" && <IngredientsView notify={notify} />}
        {view === "plan" && <PlanView notify={notify} />}
        {view === "settings" && (
          <SettingsView navigate={setView} notify={notify} />
        )}
      </main>
      <ToastStack toasts={toasts} />
    </div>
  );
}

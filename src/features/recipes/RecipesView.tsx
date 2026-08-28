import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import SearchHeader from "../../components/SearchHeader";
import { format, normalizeSearchText } from "../../constants";
import { useData } from "../../hooks/useData";
import { convertFileSrc } from "../../services/tauri";
import type { Notify, Recipe } from "../../types/domain";
import fallbackFood from "../../assets/food.jpg";
import ConfirmDelete from "./ConfirmDelete";
import RecipeForm from "./RecipeForm";
import RecipeInfo from "./RecipeInfo";

type RecipeModal =
  | { type: "form"; recipe?: Recipe }
  | { type: "info" | "delete"; recipe: Recipe }
  | null;

export default function RecipesView({ notify }: { notify: Notify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: recipes, error } = useData("get_recipes", refreshKey);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<RecipeModal>(null);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  const filtered =
    recipes?.filter((recipe) =>
      normalizeSearchText(recipe.name).includes(normalizeSearchText(query)),
    ) ?? [];
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

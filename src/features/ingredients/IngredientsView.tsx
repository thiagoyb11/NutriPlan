import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import SearchHeader from "../../components/SearchHeader";
import { format, normalizeSearchText } from "../../constants";
import { useData } from "../../hooks/useData";
import type { Notify } from "../../types/domain";
import IngredientForm from "./IngredientForm";

export default function IngredientsView({ notify }: { notify: Notify }) {
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
    ) ?? [];

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

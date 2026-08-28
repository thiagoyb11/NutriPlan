import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import Modal from "../../components/Modal";
import Picker from "../../components/Picker";
import { invoke, openImage } from "../../services/tauri";
import type {
  Ingredient,
  Notify,
  Recipe,
  RecipeIngredient,
  SelectedIngredient,
} from "../../types/domain";
import IngredientForm from "../ingredients/IngredientForm";

interface RecipeFormProps {
  recipe?: Recipe;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}

export default function RecipeForm({
  recipe,
  onClose,
  onSaved,
  notify,
}: RecipeFormProps) {
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [name, setName] = useState(recipe?.name ?? "");
  const [imagePath, setImagePath] = useState(recipe?.image_path ?? "");
  const [selected, setSelected] = useState<SelectedIngredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([
      invoke("get_ingredients"),
      recipe
        ? invoke("get_ing_rec", { id: recipe.id })
        : Promise.resolve<RecipeIngredient[]>([]),
    ])
      .then(([all, amounts]) => {
        if (!current) return;
        setIngredients(all);
        const byId = new Map(all.map((item) => [item.id, item]));
        setSelected(
          amounts.flatMap((item) => {
            const ingredient = byId.get(item.id);
            return ingredient ? [{ ...ingredient, amount: item.cant }] : [];
          }),
        );
      })
      .catch(notify);
    return () => {
      current = false;
    };
  }, [recipe, notify]);

  const add = (item: Ingredient) =>
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
      if (recipe) await invoke("update_recipe", { ...payload, id: recipe.id });
      else await invoke("save_recipe", payload);
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
          data-autofocus
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
            setIngredients((items) =>
              items ? [...items, ingredient] : [ingredient],
            );
            add(ingredient);
          }}
        />
      )}
    </>
  );
}

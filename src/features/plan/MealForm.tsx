import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import Modal from "../../components/Modal";
import Picker from "../../components/Picker";
import { dayNames, slotLabel } from "../../constants";
import { useData } from "../../hooks/useData";
import { invoke } from "../../services/tauri";
import type { MealSlot, Notify, Recipe } from "../../types/domain";

interface Props {
  day: number;
  slot: number;
  meal: MealSlot | null;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}

export default function MealForm({
  day,
  slot,
  meal,
  onClose,
  onSaved,
  notify,
}: Props) {
  const { data: recipes, error } = useData("get_recipes");
  const [selected, setSelected] = useState<Recipe | MealSlot | null>(meal);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);

  const save = async () => {
    if (!selected) return notify("Selecciona una receta.");
    const recipeId = "id" in selected ? selected.id : selected.recipe_id;
    try {
      setBusy(true);
      await invoke("save_meal", { day, slot, recipeId });
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

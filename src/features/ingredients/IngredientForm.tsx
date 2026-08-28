import { useState, type FormEvent } from "react";
import Modal from "../../components/Modal";
import { macroDefinitions } from "../../constants";
import { invoke } from "../../services/tauri";
import type { Ingredient, MacroKey, Notify } from "../../types/domain";

interface IngredientFormProps {
  initialName?: string;
  onClose: () => void;
  onSaved: (ingredient: Ingredient) => void;
  notify: Notify;
}

type FormValues = Record<MacroKey, number | string> & { name: string };

export default function IngredientForm({
  initialName = "",
  onClose,
  onSaved,
  notify,
}: IngredientFormProps) {
  const [values, setValues] = useState<FormValues>({
    name: initialName,
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof FormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: values.name.trim(),
      calories: Number(values.calories),
      protein: Number(values.protein),
      carbs: Number(values.carbs),
      fats: Number(values.fats),
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
          data-autofocus
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

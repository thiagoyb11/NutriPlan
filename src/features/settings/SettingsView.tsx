import { useEffect, useState, type FormEvent } from "react";
import Loading from "../../components/Loading";
import { macroDefinitions } from "../../constants";
import { useData } from "../../hooks/useData";
import { invoke } from "../../services/tauri";
import type {
  MacroGoals,
  MacroKey,
  Notify,
  ViewName,
} from "../../types/domain";

type GoalForm = Record<MacroKey, number | string>;

export default function SettingsView({
  navigate,
  notify,
}: {
  navigate: (view: ViewName) => void;
  notify: Notify;
}) {
  const { data: goals, error } = useData("get_macro_goals");
  const [values, setValues] = useState<GoalForm | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (goals) setValues(goals);
  }, [goals]);
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  if (!values) return <Loading />;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload: MacroGoals = {
      calories: Number(values.calories),
      protein: Number(values.protein),
      carbs: Number(values.carbs),
      fats: Number(values.fats),
    };
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
                  setValues(
                    (current) =>
                      current && {
                        ...current,
                        [macro.key]: event.target.value,
                      },
                  )
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

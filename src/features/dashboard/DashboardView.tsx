import { useEffect, useState } from "react";
import Loading from "../../components/Loading";
import { dayNames, macroDefinitions } from "../../constants";
import { invoke } from "../../services/tauri";
import type {
  MacroGoals,
  MealSlot,
  Notify,
  Nutrients,
  ViewName,
} from "../../types/domain";
import ProgressBar from "./ProgressBar";

interface DashboardData {
  meals: MealSlot[];
  goals: MacroGoals;
}

export default function DashboardView({
  navigate,
  notify,
}: {
  navigate: (view: ViewName) => void;
  notify: Notify;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
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
            .reduce<Nutrients>(
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

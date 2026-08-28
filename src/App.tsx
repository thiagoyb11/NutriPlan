import { useState } from "react";
import ToastStack from "./components/ToastStack";
import DashboardView from "./features/dashboard/DashboardView";
import IngredientsView from "./features/ingredients/IngredientsView";
import PlanView from "./features/plan/PlanView";
import RecipesView from "./features/recipes/RecipesView";
import SettingsView from "./features/settings/SettingsView";
import { useToasts } from "./hooks/useToasts";
import type { ViewName } from "./types/domain";

const views: ReadonlyArray<[ViewName, string]> = [
  ["dashboard", "Dashboard"],
  ["recipes", "Recetas"],
  ["ingredients", "Ingredientes"],
  ["plan", "Plan semanal"],
  ["settings", "Configuración"],
];

export default function App() {
  const [view, setView] = useState<ViewName>("recipes");
  const { toasts, notify } = useToasts();

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

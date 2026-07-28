const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { emit } = window.__TAURI__.event;
const params = new URLSearchParams(location.search);
const day = Number(params.get("day"));
const slot = Number(params.get("slot"));
const selected = new Map();

function error(message) {
  alert(message);
}
function renderSelected() {
  const list = document.getElementById("selected-recipes");
  list.replaceChildren();
  selected.forEach((recipe) => {
    const row = document.createElement("div");
    row.className = "selected-row";
    const text = document.createElement("span");
    text.textContent = `${recipe.name} · ${Number(recipe.calories).toFixed(0)} kcal`;
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Quitar";
    remove.onclick = () => {
      selected.delete(recipe.id);
      renderSelected();
    };
    row.append(text, remove);
    list.appendChild(row);
  });
}
document.addEventListener("DOMContentLoaded", () => getCurrentWindow().show());
async function preloadSelectedRecipes() {
  try {
    const meals = await invoke("get_meals");
    meals
      .filter((meal) => meal.day === day && meal.slot === slot)
      .forEach((meal) => selected.set(meal.recipe_id, meal));
    renderSelected();
  } catch (e) {
    error(String(e));
  }
}
document.getElementById("add-recipe").addEventListener("click", async () => {
  try {
    const recipes = await invoke("get_recipes");
    const query = document.getElementById("recipe-search");
    query.hidden = false;
    query.focus();
    const results = document.getElementById("recipe-results");
    const render = () => {
      results.replaceChildren();
      const text = query.value.trim().toLowerCase();
      if (!text) return;
      recipes
        .filter((item) => item.name.toLowerCase().includes(text))
        .slice(0, 12)
        .forEach((item) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "choice";
          option.textContent = item.name;
          option.onclick = () => {
            selected.set(item.id, item);
            query.value = "";
            results.replaceChildren();
            renderSelected();
          };
          results.appendChild(option);
        });
    };
    query.oninput = render;
    render();
  } catch (e) {
    error(String(e));
  }
});
document.getElementById("submit").addEventListener("click", async () => {
  if (!Number.isInteger(day) || !Number.isInteger(slot) || !selected.size)
    return error("Selecciona al menos una receta.");
  try {
    await invoke("save_meal", { day, slot, recipeIds: [...selected.keys()] });
    await emit("meal-saved");
    getCurrentWindow().close();
  } catch (e) {
    error(String(e));
  }
});
preloadSelectedRecipes();

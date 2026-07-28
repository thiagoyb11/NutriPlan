const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { open } = window.__TAURI__.dialog;
const { emit } = window.__TAURI__.event;

const selected = new Map();
const recipeId = Number(new URLSearchParams(location.search).get("id"));
const nameInput = document.getElementById("name");
const imageInput = document.getElementById("file");
const ingredientList = document.getElementById("selected-ingredients");

function error(message) {
  alert(message);
}
function renderSelected() {
  ingredientList.replaceChildren();
  selected.forEach((ingredient, id) => {
    const row = document.createElement("div");
    row.className = "selected-row";
    const label = document.createElement("label");
    label.textContent = `${ingredient.name} (g)`;
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "0.1";
    amount.step = "0.1";
    amount.value = ingredient.amount;
    amount.addEventListener("input", () => (ingredient.amount = amount.value));
    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => {
      selected.delete(id);
      renderSelected();
    });
    row.append(label, amount, remove);
    ingredientList.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", () => getCurrentWindow().show());
async function loadRecipe() {
  if (!Number.isInteger(recipeId) || recipeId <= 0) return;
  try {
    const [recipes, ingredients, quantities] = await Promise.all([
      invoke("get_recipes"),
      invoke("get_ingredients"),
      invoke("get_ing_rec", { id: recipeId }),
    ]);
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) return error("La receta ya no existe.");
    nameInput.value = recipe.name;
    imageInput.value = recipe.image_path || "";
    const byId = new Map(ingredients.map((item) => [item.id, item]));
    quantities.forEach((item) => {
      const ingredient = byId.get(item.id);
      if (ingredient)
        selected.set(item.id, { ...ingredient, amount: item.cant });
    });
    document.querySelector("h1").textContent = "Editar receta";
    document.getElementById("submit").textContent = "Guardar cambios";
    renderSelected();
  } catch (e) {
    error(String(e));
  }
}
document.getElementById("upload-btn").addEventListener("click", async () => {
  try {
    const path = await open({
      filters: [
        { name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] },
      ],
      multiple: false,
    });
    if (path)
      imageInput.value = await invoke("save_image", { sourcePath: path });
  } catch (e) {
    error(String(e));
  }
});
document
  .getElementById("add-ingredient")
  .addEventListener("click", async () => {
    try {
      const ingredients = await invoke("get_ingredients");
      const query = document.getElementById("ingredient-search");
      query.hidden = false;
      query.focus();
      const results = document.getElementById("ingredient-results");
      const render = () => {
        results.replaceChildren();
        const text = query.value.trim().toLowerCase();
        if (!text) return;
        ingredients
          .filter((item) => item.name.toLowerCase().includes(text))
          .slice(0, 12)
          .forEach((item) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "choice";
            option.textContent = item.name;
            option.addEventListener("click", () => {
              if (!selected.has(item.id))
                selected.set(item.id, { ...item, amount: 100 });
              query.value = "";
              results.replaceChildren();
              renderSelected();
            });
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
  const name = nameInput.value.trim();
  const entries = [...selected.values()];
  const quantities = entries.map((item) => Number(item.amount));
  if (
    !name ||
    !entries.length ||
    quantities.some((amount) => !Number.isFinite(amount) || amount <= 0)
  )
    return error(
      "Indica un nombre, al menos un ingrediente y cantidades mayores que cero.",
    );
  try {
    const payload = {
      name,
      img: imageInput.value,
      ids: entries.map((item) => item.id),
      quant: quantities,
    };
    if (Number.isInteger(recipeId) && recipeId > 0)
      await invoke("update_recipe", { ...payload, id: recipeId });
    else await invoke("save_recipe", payload);
    await emit("new-recipe");
    getCurrentWindow().close();
  } catch (e) {
    error(String(e));
  }
});
loadRecipe();

const { invoke, convertFileSrc } = window.__TAURI__.core;
const { open: openFile } = window.__TAURI__.dialog;
const content = document.getElementById("right-side");
const dayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
let activeView = "";

const format = (value) => Number(value || 0).toFixed(1);
function showToast(message, type = "error") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}
const showError = (error) =>
  showToast(typeof error === "string" ? error : "Ocurrió un error inesperado.");
function setActiveView(view) {
  document
    .querySelectorAll(".sidebar nav button")
    .forEach((button) =>
      button.classList.toggle("active", button.id === `${view}-btn`),
    );
}
function button(text, className = "") {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.className = className;
  return element;
}
function input(placeholder, type = "text") {
  const element = document.createElement("input");
  element.type = type;
  element.placeholder = placeholder;
  return element;
}

function openModal(title, buildContent, size = "normal", { onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "presentation");
  const modal = document.createElement("section");
  modal.className = `modal modal-${size}`;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", title);
  const header = document.createElement("header");
  header.className = "modal-header";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const close = button("×", "modal-close");
  close.setAttribute("aria-label", "Cerrar");
  const body = document.createElement("div");
  body.className = "modal-body";
  header.append(heading, close);
  modal.append(header, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const closeModal = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === "Escape") closeModal();
  };
  close.addEventListener("click", closeModal);
  document.addEventListener("keydown", onKey);
  buildContent(body, closeModal);
  setTimeout(() => close.focus(), 0);
}

function confirmModal(title, message, onConfirm) {
  openModal(title, (body, close) => {
    const text = document.createElement("p");
    text.className = "modal-confirmation";
    text.textContent = message;
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = button("Cancelar", "secondary");
    const confirmButton = button("Eliminar", "danger");
    cancel.addEventListener("click", close);
    confirmButton.addEventListener("click", async () => {
      confirmButton.disabled = true;
      try {
        await onConfirm();
        close();
      } catch (error) {
        confirmButton.disabled = false;
        showError(error);
      }
    });
    actions.append(cancel, confirmButton);
    body.append(text, actions);
  });
}

function createPicker(
  items,
  labelOf,
  onPick,
  placeholder,
  { emptyAction } = {},
) {
  const search = input(placeholder);
  const results = document.createElement("div");
  results.className = "picker-results";
  const render = () => {
    results.replaceChildren();
    const query = search.value.trim();
    if (!query) return;
    const matches = items
      .filter((item) =>
        labelOf(item).toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 12);
    matches.forEach((item) => {
      const option = button(labelOf(item), "choice");
      option.addEventListener("click", () => {
        onPick(item);
        search.value = "";
        results.replaceChildren();
        search.focus();
      });
      results.appendChild(option);
    });
    if (!matches.length && emptyAction) {
      const action = emptyAction(query);
      if (action) results.appendChild(action);
    }
  };
  search.addEventListener("input", render);
  return [search, results];
}

async function openRecipeForm(recipe = null) {
  try {
    const ingredients = await invoke("get_ingredients");
    const selected = new Map();
    if (recipe) {
      const amounts = await invoke("get_ing_rec", { id: recipe.id });
      const byId = new Map(ingredients.map((item) => [item.id, item]));
      amounts.forEach((item) => {
        const ingredient = byId.get(item.id);
        if (ingredient)
          selected.set(item.id, { ...ingredient, amount: item.cant });
      });
    }
    openModal(recipe ? "Editar receta" : "Nueva receta", (body, close) => {
      const name = input("Nombre de la receta");
      name.value = recipe?.name || "";
      const imagePath = input("Sin imagen seleccionada");
      imagePath.readOnly = true;
      imagePath.value = recipe?.image_path || "";
      const upload = button("Elegir imagen", "secondary");
      const imageRow = document.createElement("div");
      imageRow.className = "inline-field";
      imageRow.append(imagePath, upload);
      const title = document.createElement("h3");
      title.textContent = "Ingredientes";
      const list = document.createElement("div");
      list.className = "selection-list";
      const renderSelected = () => {
        list.replaceChildren();
        selected.forEach((item) => {
          const row = document.createElement("div");
          row.className = "selected-row";
          const label = document.createElement("span");
          label.textContent = item.name;
          const amount = input("Cantidad", "number");
          amount.min = "0.1";
          amount.step = "0.1";
          amount.value = item.amount;
          amount.addEventListener("input", () => (item.amount = amount.value));
          const remove = button("Quitar", "danger");
          remove.addEventListener("click", () => {
            selected.delete(item.id);
            renderSelected();
          });
          row.append(label, amount, remove);
          list.appendChild(row);
        });
      };
      const [search, results] = createPicker(
        ingredients,
        (item) => item.name,
        (item) => {
          if (!selected.has(item.id))
            selected.set(item.id, { ...item, amount: 100 });
          renderSelected();
        },
        "Buscar ingrediente...",
        {
          emptyAction: (query) => {
            const addIngredient = button(
              `+ Agregar “${query}” como ingrediente`,
              "choice picker-create",
            );
            addIngredient.addEventListener("click", () => {
              openIngredientForm({
                initialName: query,
                onSaved: (ingredient) => {
                  ingredients.push(ingredient);
                  selected.set(ingredient.id, { ...ingredient, amount: 100 });
                  renderSelected();
                  search.value = "";
                  results.replaceChildren();
                },
                onClosed: () => setTimeout(() => search.focus(), 0),
              });
            });
            return addIngredient;
          },
        },
      );
      const save = button(recipe ? "Guardar cambios" : "Guardar receta");
      save.classList.add("modal-primary");
      upload.addEventListener("click", async () => {
        try {
          const path = await openFile({
            filters: [
              { name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] },
            ],
            multiple: false,
          });
          if (path)
            imagePath.value = await invoke("save_image", { sourcePath: path });
        } catch (error) {
          showError(error);
        }
      });
      save.addEventListener("click", async () => {
        const entries = [...selected.values()];
        const quantities = entries.map((item) => Number(item.amount));
        if (
          !name.value.trim() ||
          !entries.length ||
          quantities.some((amount) => !Number.isFinite(amount) || amount <= 0)
        )
          return showToast(
            "Indica un nombre, ingredientes y cantidades válidas.",
          );
        try {
          const payload = {
            name: name.value.trim(),
            img: imagePath.value,
            ids: entries.map((item) => item.id),
            quant: quantities,
          };
          if (recipe)
            await invoke("update_recipe", { ...payload, id: recipe.id });
          else await invoke("save_recipe", payload);
          close();
          showToast("Receta guardada.", "success");
          showRecipes();
        } catch (error) {
          showError(error);
        }
      });
      body.append(name, imageRow, title, search, results, list, save);
      renderSelected();
    });
  } catch (error) {
    showError(error);
  }
}

async function openRecipeInfo(recipe) {
  try {
    const [items, ingredients] = await Promise.all([
      invoke("get_ing_rec", { id: recipe.id }),
      invoke("get_ingredients"),
    ]);
    const byId = new Map(ingredients.map((item) => [item.id, item]));
    openModal(
      "Valor nutricional",
      (body) => {
        const subtitle = document.createElement("p");
        subtitle.className = "modal-subtitle";
        subtitle.textContent = recipe.name;
        const wrap = document.createElement("div");
        wrap.className = "table-scroll";
        const table = document.createElement("table");
        table.className = "nutrition-table";
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        [
          "Ingrediente",
          "Cantidad",
          "Calorías",
          "Proteína",
          "Carbohidratos",
          "Grasas",
        ].forEach((value) => {
          const cell = document.createElement("th");
          cell.textContent = value;
          headRow.appendChild(cell);
        });
        head.appendChild(headRow);
        const tableBody = document.createElement("tbody");
        const totals = {
          amount: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
        };
        items.forEach((item) => {
          const ingredient = byId.get(item.id);
          if (!ingredient) return;
          const amount = Number(item.cant);
          const values = [
            ingredient.calories,
            ingredient.protein,
            ingredient.carbs,
            ingredient.fats,
          ].map((value) => (Number(value) * amount) / 100);
          totals.amount += amount;
          totals.calories += values[0];
          totals.protein += values[1];
          totals.carbs += values[2];
          totals.fats += values[3];
          const row = document.createElement("tr");
          [
            ingredient.name,
            `${format(amount)} g`,
            `${format(values[0])} kcal`,
            `${format(values[1])} g`,
            `${format(values[2])} g`,
            `${format(values[3])} g`,
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
          });
          tableBody.appendChild(row);
        });
        const total = document.createElement("tr");
        total.className = "total-row";
        [
          "Totales",
          `${format(totals.amount)} g`,
          `${format(totals.calories)} kcal`,
          `${format(totals.protein)} g`,
          `${format(totals.carbs)} g`,
          `${format(totals.fats)} g`,
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          total.appendChild(cell);
        });
        tableBody.appendChild(total);
        table.append(head, tableBody);
        wrap.appendChild(table);
        body.append(subtitle, wrap);
      },
      "wide",
    );
  } catch (error) {
    showError(error);
  }
}

function recipeCard(recipe) {
  const card = document.createElement("article");
  card.className = "card recipe-card";
  const image = document.createElement("div");
  image.className = "recipe-image";
  image.style.backgroundImage = `url("${recipe.image_path ? convertFileSrc(recipe.image_path) : "/assets/food.jpg"}")`;
  const title = document.createElement("h3");
  title.textContent = recipe.name;
  const macros = document.createElement("p");
  macros.className = "macros";
  macros.textContent = `Calorías: ${format(recipe.calories)} kcal\nProteína: ${format(recipe.protein)} g\nCarbohidratos: ${format(recipe.carbs)} g\nGrasas: ${format(recipe.fats)} g`;
  const actions = document.createElement("div");
  actions.className = "card-actions";
  const details = button("Ver ingredientes");
  details.addEventListener("click", () => openRecipeInfo(recipe));
  const edit = button("Editar");
  edit.addEventListener("click", () => openRecipeForm(recipe));
  const remove = button("Eliminar", "danger");
  remove.addEventListener("click", () =>
    confirmModal(
      "Eliminar receta",
      `¿Eliminar la receta “${recipe.name}”? También se quitará de los planes.`,
      async () => {
        await invoke("delete_recipe", { id: recipe.id });
        showToast("Receta eliminada.", "success");
        await showRecipes();
      },
    ),
  );
  actions.append(details, edit, remove);
  card.append(image, title, macros, actions);
  return card;
}

async function showRecipes() {
  activeView = "recipes";
  setActiveView("recetas");
  content.replaceChildren();
  const header = document.createElement("section");
  header.className = "hero";
  const search = input("Buscar recetas...");
  const add = button("+ Agregar receta");
  add.addEventListener("click", () => openRecipeForm());
  header.append(search, add);
  const grid = document.createElement("section");
  grid.className = "grid";
  content.append(header, grid);
  try {
    const recipes = await invoke("get_recipes");
    recipes.forEach((recipe) => grid.appendChild(recipeCard(recipe)));
    search.addEventListener("input", () =>
      grid
        .querySelectorAll(".recipe-card")
        .forEach(
          (card) =>
            (card.hidden = !card
              .querySelector("h3")
              .textContent.toLowerCase()
              .includes(search.value.toLowerCase())),
        ),
    );
  } catch (error) {
    showError(error);
  }
}
function ingredientCard(ingredient) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h3");
  title.textContent = ingredient.name;
  const macros = document.createElement("p");
  macros.className = "macros";
  macros.textContent = `Por 100 g\nCalorías: ${format(ingredient.calories)} kcal\nProteína: ${format(ingredient.protein)} g\nCarbohidratos: ${format(ingredient.carbs)} g\nGrasas: ${format(ingredient.fats)} g`;
  card.append(title, macros);
  return card;
}
function openIngredientForm({ initialName = "", onSaved, onClosed } = {}) {
  openModal(
    "Nuevo ingrediente",
    (body, close) => {
      const name = input("Nombre del ingrediente");
      name.value = initialName;
      const fields = [
        ["Calorías", "calories"],
        ["Proteína (g)", "protein"],
        ["Carbohidratos (g)", "carbs"],
        ["Grasas (g)", "fats"],
      ];
      const values = {};
      const grid = document.createElement("div");
      grid.className = "nutrition-fields";
      fields.forEach(([labelText, key]) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        const value = input("0", "number");
        value.min = "0";
        value.step = "0.1";
        value.value = "0";
        values[key] = value;
        label.appendChild(value);
        grid.appendChild(label);
      });
      const save = button("Guardar ingrediente");
      save.classList.add("modal-primary");
      save.addEventListener("click", async () => {
        const payload = {
          name: name.value.trim(),
          calories: Number(values.calories.value),
          protein: Number(values.protein.value),
          carbs: Number(values.carbs.value),
          fats: Number(values.fats.value),
        };
        if (
          !payload.name ||
          Object.values(payload)
            .slice(1)
            .some((value) => !Number.isFinite(value) || value < 0)
        )
          return showToast(
            "Completa un nombre y valores nutricionales válidos.",
          );
        try {
          const ingredient = await invoke("save_ingredient", payload);
          onSaved?.(ingredient);
          close();
          showToast("Ingrediente agregado.", "success");
          if (!onSaved) showIngredients();
        } catch (error) {
          showError(error);
        }
      });
      body.append(name, grid, save);
      name.focus();
    },
    "normal",
    { onClose: onClosed },
  );
}
async function showIngredients() {
  activeView = "ingredients";
  setActiveView("ing");
  content.replaceChildren();
  const header = document.createElement("section");
  header.className = "hero";
  const search = input("Buscar ingredientes...");
  const add = button("+ Agregar ingrediente");
  add.addEventListener("click", openIngredientForm);
  header.append(search, add);
  const grid = document.createElement("section");
  grid.className = "grid";
  content.append(header, grid);
  try {
    const ingredients = await invoke("get_ingredients");
    ingredients.forEach((item) => grid.appendChild(ingredientCard(item)));
    search.addEventListener("input", () =>
      grid
        .querySelectorAll(".card")
        .forEach(
          (card) =>
            (card.hidden = !card
              .querySelector("h3")
              .textContent.toLowerCase()
              .includes(search.value.toLowerCase())),
        ),
    );
  } catch (error) {
    showError(error);
  }
}

const macroDefinitions = [
  { key: "calories", label: "Calorías", unit: "kcal" },
  { key: "protein", label: "Proteína", unit: "g" },
  { key: "carbs", label: "Carbohidratos", unit: "g" },
  { key: "fats", label: "Grasas", unit: "g" },
];

function progressState(percent) {
  if (percent < 50) return "low";
  if (percent < 80) return "medium";
  return "good";
}

function progressBar(macro, amount, goal) {
  const percent = goal > 0 ? (amount / goal) * 100 : 0;
  const row = document.createElement("div");
  row.className = "macro-progress";
  const label = document.createElement("div");
  label.className = "macro-progress-label";
  const name = document.createElement("span");
  name.textContent = macro.label;
  const value = document.createElement("span");
  value.textContent =
    goal > 0
      ? `${format(amount)} / ${format(goal)} ${macro.unit} · ${Math.round(percent)}%`
      : `${format(amount)} ${macro.unit} · sin objetivo`;
  label.append(name, value);
  const track = document.createElement("div");
  track.className = "macro-progress-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute(
    "aria-label",
    `${macro.label}: ${Math.round(percent)}% del objetivo`,
  );
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute(
    "aria-valuenow",
    String(Math.min(Math.round(percent), 100)),
  );
  const fill = document.createElement("div");
  fill.className = `macro-progress-fill ${progressState(percent)}`;
  fill.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
  track.appendChild(fill);
  row.append(label, track);
  return row;
}

async function showDashboard() {
  activeView = "dashboard";
  setActiveView("dashboard");
  content.replaceChildren();
  const [meals, goals] = await Promise.all([
    invoke("get_meals"),
    invoke("get_macro_goals"),
  ]);
  const header = document.createElement("section");
  header.className = "dashboard-heading";
  const title = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = "Dashboard semanal";
  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Avance diario frente a tus objetivos de macronutrientes.";
  title.append(heading, subtitle);
  const settings = button("Configurar objetivos", "secondary");
  settings.addEventListener("click", showSettings);
  header.append(title, settings);
  const grid = document.createElement("section");
  grid.className = "dashboard-grid";
  dayNames.forEach((dayName, day) => {
    const totals = meals
      .filter((meal) => meal.day === day)
      .reduce(
        (result, meal) => {
          macroDefinitions.forEach(
            ({ key }) => (result[key] += Number(meal[key]) || 0),
          );
          return result;
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0 },
      );
    const card = document.createElement("article");
    card.className = "dashboard-day";
    const name = document.createElement("h3");
    name.textContent = dayName;
    card.appendChild(name);
    macroDefinitions.forEach((macro) =>
      card.appendChild(
        progressBar(macro, totals[macro.key], Number(goals[macro.key]) || 0),
      ),
    );
    grid.appendChild(card);
  });
  content.append(header, grid);
}

async function showSettings() {
  activeView = "settings";
  setActiveView("config");
  content.replaceChildren();
  const goals = await invoke("get_macro_goals");
  const panel = document.createElement("section");
  panel.className = "settings-panel";
  const heading = document.createElement("h2");
  heading.textContent = "Configuración";
  const description = document.createElement("p");
  description.textContent =
    "Personaliza cómo se evalúa tu planificación semanal.";
  const section = document.createElement("section");
  section.className = "settings-subsection";
  const sectionHeading = document.createElement("h3");
  sectionHeading.textContent = "Objetivos diarios";
  const sectionDescription = document.createElement("p");
  sectionDescription.textContent =
    "Se aplican a todos los días del dashboard semanal.";
  const form = document.createElement("form");
  form.className = "goal-form";
  const fields = {};
  macroDefinitions.forEach((macro) => {
    const label = document.createElement("label");
    label.textContent = `${macro.label} diaria (${macro.unit})`;
    const field = input("0", "number");
    field.min = "0";
    field.step = "0.1";
    field.value = Number(goals[macro.key]) || 0;
    fields[macro.key] = field;
    label.appendChild(field);
    form.appendChild(label);
  });
  const save = button("Guardar objetivos");
  save.type = "submit";
  form.appendChild(save);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(
      macroDefinitions.map(({ key }) => [key, Number(fields[key].value)]),
    );
    if (
      Object.values(values).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    )
      return showToast("Indica objetivos diarios válidos.");
    try {
      save.disabled = true;
      await invoke("save_macro_goals", values);
      showToast("Objetivos guardados.", "success");
      await showDashboard();
    } catch (error) {
      showError(error);
    } finally {
      save.disabled = false;
    }
  });
  section.append(sectionHeading, sectionDescription, form);
  panel.append(heading, description, section);
  content.appendChild(panel);
}
const slotLabel = (slot) =>
  `${String(Math.floor((slot * 30) / 60)).padStart(2, "0")}:${String((slot * 30) % 60).padStart(2, "0")}`;
async function openMealForm(day, slot, meal = null) {
  try {
    const recipes = await invoke("get_recipes");
    let selectedRecipe = meal
      ? recipes.find((recipe) => recipe.id === meal.recipe_id) || meal
      : null;

    openModal(`${dayNames[day]} · ${slotLabel(slot)}`, (body, close) => {
      const text = document.createElement("p");
      text.className = "modal-subtitle";
      text.textContent =
        "Selecciona una receta para esta franja de 30 minutos.";
      const selection = document.createElement("div");
      selection.className = "selection-list";
      const render = () => {
        selection.replaceChildren();
        if (!selectedRecipe) return;
        const row = document.createElement("div");
        row.className = "selected-row";
        const name = document.createElement("span");
        name.textContent = `${selectedRecipe.name} · ${Math.round(selectedRecipe.calories)} kcal`;
        const clear = button("Quitar", "danger");
        clear.addEventListener("click", () => {
          selectedRecipe = null;
          render();
        });
        row.append(name, clear);
        selection.appendChild(row);
      };
      const [search, results] = createPicker(
        recipes,
        (item) => item.name,
        (item) => {
          selectedRecipe = item;
          render();
        },
        "Buscar receta...",
      );
      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const remove = button("Eliminar comida", "danger");
      remove.hidden = !meal;
      remove.addEventListener("click", async () => {
        try {
          await invoke("delete_meal", { day, slot });
          close();
          showToast("Comida eliminada.", "success");
          showPlan();
        } catch (error) {
          showError(error);
        }
      });
      const save = button("Guardar comida");
      save.addEventListener("click", async () => {
        if (!selectedRecipe) return showToast("Selecciona una receta.");
        try {
          await invoke("save_meal", {
            day,
            slot,
            recipeId: selectedRecipe.id || selectedRecipe.recipe_id,
          });
          close();
          showToast("Comida guardada.", "success");
          showPlan();
        } catch (error) {
          showError(error);
        }
      });
      actions.append(remove, save);
      body.append(text, search, results, selection, actions);
      render();
    });
  } catch (error) {
    showError(error);
  }
}

async function openShoppingList() {
  try {
    const items = await invoke("get_shopping_list");
    openModal("Lista de compra", (body) => {
      if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "modal-subtitle";
        empty.textContent =
          "Agrega recetas al plan semanal para generar la lista de compra.";
        body.appendChild(empty);
        return;
      }
      const subtitle = document.createElement("p");
      subtitle.className = "modal-subtitle";
      subtitle.textContent =
        "Cantidades totales necesarias para todas las comidas planificadas.";
      const list = document.createElement("ul");
      list.className = "shopping-list";
      items.forEach((item) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = item.name;
        const amount = document.createElement("strong");
        amount.textContent = `${format(item.amount)} g`;
        row.append(name, amount);
        list.appendChild(row);
      });
      body.append(subtitle, list);
    });
  } catch (error) {
    showError(error);
  }
}

async function showPlan() {
  activeView = "plan";
  setActiveView("pl");
  content.replaceChildren();
  const [meals, ingredients] = await Promise.all([
    invoke("get_meals"),
    invoke("get_ingredients"),
  ]);
  const ingredientById = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const recipeIngredients = new Map(
    await Promise.all(
      [...new Set(meals.map((meal) => meal.recipe_id))].map(
        async (recipeId) => [
          recipeId,
          await invoke("get_ing_rec", { id: recipeId }),
        ],
      ),
    ),
  );
  const header = document.createElement("div");
  header.className = "plan-heading";
  const title = document.createElement("h2");
  title.textContent = "Plan semanal";
  const shopping = button("Lista de compra", "secondary");
  shopping.addEventListener("click", openShoppingList);
  header.append(title, shopping);
  content.appendChild(header);

  const mealBySlot = new Map(
    meals.map((meal) => [`${meal.day}-${meal.slot}`, meal]),
  );
  const table = document.createElement("table");
  table.className = "plan-table";
  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  dayNames.forEach((name) => {
    const th = document.createElement("th");
    th.textContent = name;
    head.appendChild(th);
  });
  table.appendChild(head);

  for (let slot = 0; slot < 48; slot++) {
    const row = document.createElement("tr");
    const time = document.createElement("th");
    time.textContent = slotLabel(slot);
    row.appendChild(time);
    for (let day = 0; day < 7; day++) {
      const cell = document.createElement("td");
      cell.className = "plan-cell";
      const meal = mealBySlot.get(`${day}-${slot}`) || null;
      cell.addEventListener("click", () => openMealForm(day, slot, meal));
      if (meal) {
        const entry = document.createElement("span");
        entry.className = "meal-entry";
        entry.textContent = `${meal.name} (${Math.round(meal.calories)} kcal)`;
        const details = (recipeIngredients.get(meal.recipe_id) || [])
          .map((item) => {
            const ingredient = ingredientById.get(item.id);
            return ingredient
              ? `${ingredient.name}: ${format(item.cant)} g`
              : "";
          })
          .filter(Boolean)
          .join("\n");
        entry.dataset.tooltip = details || "Sin ingredientes";
        cell.appendChild(entry);
      }
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  const wrap = document.createElement("div");
  wrap.className = "plan-wrap";
  wrap.appendChild(table);
  content.appendChild(wrap);
}
document.getElementById("recetas-btn").addEventListener("click", showRecipes);
document.getElementById("ing-btn").addEventListener("click", showIngredients);
document
  .getElementById("dashboard-btn")
  .addEventListener("click", () => showDashboard().catch(showError));
document
  .getElementById("pl-btn")
  .addEventListener("click", () => showPlan().catch(showError));
document
  .getElementById("config-btn")
  .addEventListener("click", () => showSettings().catch(showError));
showRecipes();

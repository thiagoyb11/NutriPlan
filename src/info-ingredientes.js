const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

const number = (value) => Number(value || 0).toFixed(1);
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await getCurrentWindow().show();
    const params = new URLSearchParams(location.search);
    const id = Number(params.get("id"));
    document.getElementById("name-rec").textContent = params.get("name") || "";
    const [items, ingredients] = await Promise.all([invoke("get_ing_rec", { id }), invoke("get_ingredients")]);
    const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const totals = { amount: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };
    const table = document.querySelector("tbody");
    items.forEach((item) => {
      const ingredient = byId.get(item.id); if (!ingredient) return;
      const amount = Number(item.cant); const rowValues = [ingredient.calories, ingredient.protein, ingredient.carbs, ingredient.fats].map((value) => Number(value) * amount / 100);
      totals.amount += amount; totals.calories += rowValues[0]; totals.protein += rowValues[1]; totals.carbs += rowValues[2]; totals.fats += rowValues[3];
      const row = document.createElement("tr"); [ingredient.name, `${number(amount)} g`, `${number(rowValues[0])} kcal`, `${number(rowValues[1])} g`, `${number(rowValues[2])} g`, `${number(rowValues[3])} g`].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell); }); table.appendChild(row);
    });
    const total = document.createElement("tr"); ["Totales", `${number(totals.amount)} g`, `${number(totals.calories)} kcal`, `${number(totals.protein)} g`, `${number(totals.carbs)} g`, `${number(totals.fats)} g`].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; total.appendChild(cell); }); table.appendChild(total);
  } catch (error) { document.body.textContent = `No se pudo cargar la información: ${error}`; }
});

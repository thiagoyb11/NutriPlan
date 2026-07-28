use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
struct Ingrediente {
    id: u32,
    name: String,
    calories: f32,
    protein: f32,
    carbs: f32,
    fats: f32,
}

#[derive(Serialize)]
struct Receta {
    id: u32,
    name: String,
    image_path: String,
    calories: f32,
    protein: f32,
    carbs: f32,
    fats: f32,
}

#[derive(Serialize)]
struct IngredienteCantidades {
    id: u32,
    cant: f32,
}

#[derive(Serialize)]
struct MealSlot {
    day: u8,
    slot: u8,
    recipe_id: u32,
    name: String,
    calories: f32,
    protein: f32,
    carbs: f32,
    fats: f32,
}

#[derive(Serialize)]
struct ShoppingItem {
    ingredient_id: u32,
    name: String,
    amount: f32,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let path = app_data.join("nutriplan.db");

    if !path.exists() {
        std::fs::write(&path, include_bytes!("../ingredientes.db")).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn open_connection(app: &tauri::AppHandle) -> Result<Connection, String> {
    let mut conn = Connection::open(database_path(app)?).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS meal_slots (
           day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
           slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 47),
           recipe_id INTEGER NOT NULL,
           PRIMARY KEY(day, slot, recipe_id),
           FOREIGN KEY(recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
         );",
    )
    .map_err(|e| e.to_string())?;
    normalize_ingredient_names(&mut conn)?;
    conn.execute(
        "DELETE FROM meal_slots WHERE rowid NOT IN (SELECT MIN(rowid) FROM meal_slots GROUP BY day, slot)",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS meal_slots_one_recipe_per_slot
         ON meal_slots(day, slot);",
    )
    .map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS ingredients_unique_normalized_name
         ON ingredients(trim(name) COLLATE NOCASE);",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

fn normalize_ingredient_names(conn: &mut Connection) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let duplicate_names: Vec<String> = {
        let mut stmt = tx
            .prepare(
                "SELECT lower(trim(name)) FROM ingredients
                 GROUP BY lower(trim(name)) HAVING count(*) > 1",
            )
            .map_err(|e| e.to_string())?;
        let names = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        names
    };

    for normalized_name in duplicate_names {
        let ids: Vec<i64> = {
            let mut stmt = tx
                .prepare("SELECT id FROM ingredients WHERE lower(trim(name)) = ?1 ORDER BY id")
                .map_err(|e| e.to_string())?;
            let ingredient_ids = stmt
                .query_map(params![normalized_name], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            ingredient_ids
        };
        if let Some((&kept_id, duplicates)) = ids.split_first() {
            for duplicate_id in duplicates {
                let uses: Vec<(i64, f32)> = {
                    let mut stmt = tx
                        .prepare("SELECT recipe_id, amount FROM recipe_ingredients WHERE ingredient_id = ?1")
                        .map_err(|e| e.to_string())?;
                    let recipe_uses = stmt
                        .query_map(params![duplicate_id], |row| Ok((row.get(0)?, row.get(1)?)))
                        .map_err(|e| e.to_string())?
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| e.to_string())?;
                    recipe_uses
                };
                for (recipe_id, amount) in uses {
                    let existing: Option<f32> = tx
                        .query_row(
                            "SELECT amount FROM recipe_ingredients WHERE recipe_id = ?1 AND ingredient_id = ?2",
                            params![recipe_id, kept_id],
                            |row| row.get(0),
                        )
                        .ok();
                    if let Some(current_amount) = existing {
                        tx.execute(
                            "UPDATE recipe_ingredients SET amount = ?1 WHERE recipe_id = ?2 AND ingredient_id = ?3",
                            params![current_amount + amount, recipe_id, kept_id],
                        ).map_err(|e| e.to_string())?;
                        tx.execute(
                            "DELETE FROM recipe_ingredients WHERE recipe_id = ?1 AND ingredient_id = ?2",
                            params![recipe_id, duplicate_id],
                        ).map_err(|e| e.to_string())?;
                    } else {
                        tx.execute(
                            "UPDATE recipe_ingredients SET ingredient_id = ?1 WHERE recipe_id = ?2 AND ingredient_id = ?3",
                            params![kept_id, recipe_id, duplicate_id],
                        ).map_err(|e| e.to_string())?;
                    }
                }
                tx.execute(
                    "DELETE FROM ingredients WHERE id = ?1",
                    params![duplicate_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }
    tx.execute("UPDATE ingredients SET name = trim(name)", [])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_ing_rec(app: tauri::AppHandle, id: u32) -> Result<Vec<IngredienteCantidades>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT ingredient_id, amount FROM recipe_ingredients WHERE recipe_id = ?1")
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map(params![id], |row| {
            Ok(IngredienteCantidades {
                id: row.get(0)?,
                cant: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn get_ingredients(app: tauri::AppHandle) -> Result<Vec<Ingrediente>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT id, name, calories, protein, carbs, fats FROM ingredients ORDER BY name")
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([], |row| {
            Ok(Ingrediente {
                id: row.get(0)?,
                name: row.get(1)?,
                calories: row.get(2)?,
                protein: row.get(3)?,
                carbs: row.get(4)?,
                fats: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn save_ingredient(
    app: tauri::AppHandle,
    name: String,
    calories: f32,
    protein: f32,
    carbs: f32,
    fats: f32,
) -> Result<Ingrediente, String> {
    let name = name.trim();
    if name.is_empty()
        || [calories, protein, carbs, fats]
            .iter()
            .any(|value| !value.is_finite() || *value < 0.0)
    {
        return Err("Indica un nombre y valores nutricionales válidos.".into());
    }
    let conn = open_connection(&app)?;
    let inserted = conn.execute(
        "INSERT INTO ingredients (name, calories, protein, carbs, fats) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, calories, protein, carbs, fats],
    );
    match inserted {
        Ok(_) => Ok(Ingrediente {
            id: conn.last_insert_rowid() as u32,
            name: name.into(),
            calories,
            protein,
            carbs,
            fats,
        }),
        Err(error)
            if error
                .to_string()
                .contains("ingredients_unique_normalized_name") =>
        {
            Err("Ya existe un ingrediente con ese nombre.".into())
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn get_recipes(app: tauri::AppHandle) -> Result<Vec<Receta>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn.prepare("SELECT id, name, COALESCE(image_path, ''), calories, protein, carbs, fats FROM recipes ORDER BY name")
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([], |row| {
            Ok(Receta {
                id: row.get(0)?,
                name: row.get(1)?,
                image_path: row.get(2)?,
                calories: row.get(3)?,
                protein: row.get(4)?,
                carbs: row.get(5)?,
                fats: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn save_image(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let images_dir = app_data.join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    let source = PathBuf::from(&source_path);
    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    let dest = images_dir.join(format!(
        "recipe_{}.{}",
        chrono::Utc::now().timestamp_millis(),
        extension
    ));
    std::fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn save_recipe(
    app: tauri::AppHandle,
    name: String,
    img: String,
    ids: Vec<u32>,
    quant: Vec<f32>,
) -> Result<i64, String> {
    let name = name.trim();
    if name.is_empty()
        || ids.is_empty()
        || ids.len() != quant.len()
        || quant
            .iter()
            .any(|amount| !amount.is_finite() || *amount <= 0.0)
    {
        return Err("La receta debe tener un nombre y cantidades válidas.".into());
    }
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut calories = 0.0_f32;
    let mut protein = 0.0_f32;
    let mut carbs = 0.0_f32;
    let mut fats = 0.0_f32;
    for (ingredient_id, amount) in ids.iter().zip(quant.iter()) {
        let values: (f32, f32, f32, f32) = tx
            .query_row(
                "SELECT calories, protein, carbs, fats FROM ingredients WHERE id = ?1",
                params![ingredient_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|_| "Uno de los ingredientes ya no existe.".to_string())?;
        calories += values.0 * amount / 100.0;
        protein += values.1 * amount / 100.0;
        carbs += values.2 * amount / 100.0;
        fats += values.3 * amount / 100.0;
    }
    tx.execute("INSERT INTO recipes (name, image_path, calories, protein, carbs, fats) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![name, img, calories, protein, carbs, fats]).map_err(|e| e.to_string())?;
    let recipe_id = tx.last_insert_rowid();
    for (ingredient_id, amount) in ids.iter().zip(quant.iter()) {
        tx.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES (?1, ?2, ?3)",
            params![recipe_id, ingredient_id, amount],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(recipe_id)
}

#[tauri::command]
fn update_recipe(
    app: tauri::AppHandle,
    id: u32,
    name: String,
    img: String,
    ids: Vec<u32>,
    quant: Vec<f32>,
) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty()
        || ids.is_empty()
        || ids.len() != quant.len()
        || quant
            .iter()
            .any(|amount| !amount.is_finite() || *amount <= 0.0)
    {
        return Err("La receta debe tener un nombre y cantidades válidas.".into());
    }
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut calories = 0.0_f32;
    let mut protein = 0.0_f32;
    let mut carbs = 0.0_f32;
    let mut fats = 0.0_f32;
    for (ingredient_id, amount) in ids.iter().zip(quant.iter()) {
        let values: (f32, f32, f32, f32) = tx
            .query_row(
                "SELECT calories, protein, carbs, fats FROM ingredients WHERE id = ?1",
                params![ingredient_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|_| "Uno de los ingredientes ya no existe.".to_string())?;
        calories += values.0 * amount / 100.0;
        protein += values.1 * amount / 100.0;
        carbs += values.2 * amount / 100.0;
        fats += values.3 * amount / 100.0;
    }
    let changed = tx.execute(
        "UPDATE recipes SET name = ?1, image_path = ?2, calories = ?3, protein = ?4, carbs = ?5, fats = ?6 WHERE id = ?7",
        params![name, img, calories, protein, carbs, fats, id],
    ).map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("La receta no existe.".into());
    }
    tx.execute(
        "DELETE FROM recipe_ingredients WHERE recipe_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    for (ingredient_id, amount) in ids.iter().zip(quant.iter()) {
        tx.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount) VALUES (?1, ?2, ?3)",
            params![id, ingredient_id, amount],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_recipe(app: tauri::AppHandle, id: u32) -> Result<(), String> {
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM meal_slots WHERE recipe_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM recipe_ingredients WHERE recipe_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    let deleted = tx
        .execute("DELETE FROM recipes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("La receta no existe.".into());
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_meals(app: tauri::AppHandle) -> Result<Vec<MealSlot>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT m.day, m.slot, r.id, r.name, r.calories, r.protein, r.carbs, r.fats
         FROM meal_slots m JOIN recipes r ON r.id = m.recipe_id ORDER BY m.day, m.slot, r.name",
        )
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([], |row| {
            Ok(MealSlot {
                day: row.get(0)?,
                slot: row.get(1)?,
                recipe_id: row.get(2)?,
                name: row.get(3)?,
                calories: row.get(4)?,
                protein: row.get(5)?,
                carbs: row.get(6)?,
                fats: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
fn save_meal(app: tauri::AppHandle, day: u8, slot: u8, recipe_id: u32) -> Result<(), String> {
    if day > 6 || slot > 47 {
        return Err("La comida no es válida.".into());
    }
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM meal_slots WHERE day = ?1 AND slot = ?2",
        params![day, slot],
    )
    .map_err(|e| e.to_string())?;
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM recipes WHERE id = ?1)",
            params![recipe_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("La receta seleccionada ya no existe.".into());
    }
    tx.execute(
        "INSERT INTO meal_slots (day, slot, recipe_id) VALUES (?1, ?2, ?3)",
        params![day, slot, recipe_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_meal(app: tauri::AppHandle, day: u8, slot: u8) -> Result<(), String> {
    let conn = open_connection(&app)?;
    conn.execute(
        "DELETE FROM meal_slots WHERE day = ?1 AND slot = ?2",
        params![day, slot],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_shopping_list(app: tauri::AppHandle) -> Result<Vec<ShoppingItem>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.name, SUM(ri.amount)
             FROM meal_slots m
             JOIN recipe_ingredients ri ON ri.recipe_id = m.recipe_id
             JOIN ingredients i ON i.id = ri.ingredient_id
             GROUP BY i.id, i.name
             ORDER BY i.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let result = stmt
        .query_map([], |row| {
            Ok(ShoppingItem {
                ingredient_id: row.get(0)?,
                name: row.get(1)?,
                amount: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            open_connection(&app.handle())
                .map(|_| ())
                .map_err(Into::into)
        })
        .invoke_handler(tauri::generate_handler![
            get_ing_rec,
            get_ingredients,
            save_ingredient,
            get_recipes,
            save_image,
            save_recipe,
            update_recipe,
            delete_recipe,
            get_meals,
            save_meal,
            delete_meal,
            get_shopping_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running NutriPlan");
}

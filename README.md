# NutriPlan

Aplicación de escritorio para organizar recetas, consultar información nutricional y planificar comidas semanales.

Está construida con **React 19**, **TypeScript**, **Vite**, **Tauri 2**, Rust y SQLite. Los datos se almacenan localmente, por lo que la aplicación puede usarse sin conexión.

## Funciones

- Catálogo de ingredientes con calorías, proteínas, carbohidratos y grasas por cada 100 g.
- Alta de ingredientes con validación para evitar nombres duplicados.
- Creación y edición de recetas a partir de ingredientes y cantidades.
- Cálculo automático de macros y calorías de cada receta.
- Imagen opcional por receta.
- Consulta detallada de los ingredientes y totales nutricionales de una receta.
- Eliminación de recetas, incluyendo su limpieza en el plan semanal.
- Planificador semanal con comidas por día y franja horaria.
- Interfaz adaptativa con modales internos, sin ventanas secundarias.

## Requisitos

- Node.js y npm.
- Rust estable con Cargo.
- Dependencias de compilación requeridas por Tauri para tu sistema operativo.

## Ejecutar en desarrollo

```bash
npm install
npm run tauri dev
```

Para ejecutar o compilar únicamente el frontend:

```bash
npm run dev
npm run build
```

En PowerShell, si la política de ejecución bloquea `npm`, usa `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run tauri -- dev
```

## Compilar la aplicación

```bash
npm run tauri build
```

Para generar únicamente el ejecutable de depuración sin empaquetarlo:

```bash
npm run tauri -- build --debug --no-bundle
```

El ejecutable se genera en `src-tauri/target/debug/nutriplan.exe` en Windows.

## Datos locales

La base inicial de ingredientes se encuentra en `src-tauri/ingredientes.db`. En el primer arranque se copia automáticamente al directorio de datos de la aplicación, donde quedan guardados los ingredientes, recetas y planes del usuario.

Las imágenes seleccionadas para recetas también se guardan en ese directorio de datos.

## Estructura

```text
src/          Aplicación React + TypeScript organizada por funcionalidades
dist/         Frontend compilado por Vite (generado)
src-tauri/    Backend Rust, configuración Tauri y base inicial SQLite
data/         Datos fuente de ingredientes
```

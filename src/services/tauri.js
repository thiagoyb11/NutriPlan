const tauri = () => window.__TAURI__;

export function invoke(command, payload) {
  return tauri().core.invoke(command, payload);
}

export function convertFileSrc(path) {
  return tauri().core.convertFileSrc(path);
}

export function openImage() {
  return tauri().dialog.open({
    filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] }],
    multiple: false,
  });
}

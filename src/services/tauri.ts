import type {
  ArgTauriCommand,
  NoArgTauriCommand,
  TauriCommand,
  TauriCommands,
} from "../types/tauri";

interface TauriGlobal {
  core: {
    invoke<T>(command: string, payload?: unknown): Promise<T>;
    convertFileSrc(path: string): string;
  };
  dialog: {
    open(options: {
      filters: Array<{ name: string; extensions: string[] }>;
      multiple: boolean;
    }): Promise<string | string[] | null>;
  };
}

declare global {
  interface Window {
    __TAURI__: TauriGlobal;
  }
}

const tauri = (): TauriGlobal => window.__TAURI__;

export function invoke<C extends NoArgTauriCommand>(
  command: C,
): Promise<TauriCommands[C]["result"]>;
export function invoke<C extends ArgTauriCommand>(
  command: C,
  payload: TauriCommands[C]["args"],
): Promise<TauriCommands[C]["result"]>;
export function invoke<C extends TauriCommand>(
  command: C,
  payload?: TauriCommands[C]["args"],
): Promise<TauriCommands[C]["result"]> {
  return tauri().core.invoke<TauriCommands[C]["result"]>(command, payload);
}

export function convertFileSrc(path: string): string {
  return tauri().core.convertFileSrc(path);
}

export async function openImage(): Promise<string | null> {
  const result = await tauri().dialog.open({
    filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] }],
    multiple: false,
  });
  return typeof result === "string" ? result : null;
}

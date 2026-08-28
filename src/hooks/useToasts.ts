import { useCallback, useState } from "react";
import type { Notify, Toast } from "../types/domain";

export function useToasts(): { toasts: Toast[]; notify: Notify } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback<Notify>((value, type = "error") => {
    const message =
      typeof value === "string"
        ? value
        : value instanceof Error
          ? value.message
          : "Ocurrió un error inesperado.";
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(
      () => setToasts((items) => items.filter((item) => item.id !== id)),
      4200,
    );
  }, []);

  return { toasts, notify };
}

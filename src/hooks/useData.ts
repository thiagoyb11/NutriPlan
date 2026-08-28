import { useEffect, useState } from "react";
import { invoke } from "../services/tauri";
import type { NoArgTauriCommand, TauriCommands } from "../types/tauri";

export function useData<C extends NoArgTauriCommand>(
  command: C,
  refreshKey = 0,
) {
  const [data, setData] = useState<TauriCommands[C]["result"] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setError(null);
    invoke(command)
      .then((value) => current && setData(value))
      .catch((reason: unknown) => current && setError(reason));
    return () => {
      current = false;
    };
  }, [command, refreshKey]);

  return { data, error };
}

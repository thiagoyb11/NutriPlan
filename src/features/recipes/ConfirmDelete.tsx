import { useState } from "react";
import Modal from "../../components/Modal";
import { invoke } from "../../services/tauri";
import type { Notify, Recipe } from "../../types/domain";

interface Props {
  recipe: Recipe;
  onClose: () => void;
  onDeleted: () => void;
  notify: Notify;
}

export default function ConfirmDelete({
  recipe,
  onClose,
  onDeleted,
  notify,
}: Props) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    try {
      setBusy(true);
      await invoke("delete_recipe", { id: recipe.id });
      notify("Receta eliminada.", "success");
      onDeleted();
      onClose();
    } catch (error) {
      notify(error);
      setBusy(false);
    }
  };
  return (
    <Modal title="Eliminar receta" onClose={onClose}>
      <p className="modal-confirmation">
        ¿Eliminar la receta “{recipe.name}”? También se quitará de los planes.
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={remove}
        >
          Eliminar
        </button>
      </div>
    </Modal>
  );
}

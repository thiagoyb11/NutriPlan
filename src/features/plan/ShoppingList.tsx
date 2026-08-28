import { useEffect } from "react";
import Loading from "../../components/Loading";
import Modal from "../../components/Modal";
import { format } from "../../constants";
import { useData } from "../../hooks/useData";
import type { Notify } from "../../types/domain";

export default function ShoppingList({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: Notify;
}) {
  const { data: items, error } = useData("get_shopping_list");
  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);
  return (
    <Modal title="Lista de compra" onClose={onClose}>
      {!items ? (
        <Loading />
      ) : !items.length ? (
        <p className="modal-subtitle">
          Agrega recetas al plan semanal para generar la lista de compra.
        </p>
      ) : (
        <>
          <p className="modal-subtitle">
            Cantidades totales necesarias para todas las comidas planificadas.
          </p>
          <ul className="shopping-list">
            {items.map((item) => (
              <li key={item.ingredient_id}>
                <span>{item.name}</span>
                <strong>{format(item.amount)} g</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

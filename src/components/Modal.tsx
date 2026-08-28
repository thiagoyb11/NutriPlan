import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BodyStyles {
  overflow: string;
  paddingRight: string;
}
interface ModalProps {
  title: string;
  size?: "normal" | "wide";
  onClose: () => void;
  children: ReactNode;
}

let openModalCount = 0;
let bodyStyles: BodyStyles | null = null;
const modalStack: symbol[] = [];

export default function Modal({
  title,
  size = "normal",
  onClose,
  children,
}: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalId = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = modalId.current;
    modalStack.push(id);
    if (openModalCount === 0) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      bodyStyles = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      };
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        const currentPadding =
          Number.parseFloat(
            window.getComputedStyle(document.body).paddingRight,
          ) || 0;
        document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      }
    }
    openModalCount += 1;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalStack.at(-1) === id)
        onCloseRef.current();
    };
    document.addEventListener("keydown", handleKey);
    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        overlayRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (target ?? closeRef.current)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKey);
      const stackIndex = modalStack.lastIndexOf(id);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0 && bodyStyles) {
        document.body.style.overflow = bodyStyles.overflow;
        document.body.style.paddingRight = bodyStyles.paddingRight;
        bodyStyles = null;
      }
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

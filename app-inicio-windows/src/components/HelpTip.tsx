import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../settings/settingsContext';

const POPOVER_WIDTH = 320;
const MARGIN = 8;

/**
 * Botón redondo "?" que explica una opción en lenguaje simple.
 * - Pasar el mouse o llegar con Tab: muestra la ayuda.
 * - Clic: la deja fija (útil en pantallas táctiles). Esc o clic afuera la cierra.
 * El globo se dibuja en <body> para que ningún panel con scroll lo recorte.
 */
export function HelpTip({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const { t } = useSettings();

  const show = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const left = Math.min(
      Math.max(MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
      window.innerWidth - POPOVER_WIDTH - MARGIN,
    );
    // Si abajo no hay espacio, se abre hacia arriba.
    const above = rect.bottom + 220 > window.innerHeight;
    setPosition({ top: above ? rect.top - MARGIN : rect.bottom + MARGIN, left, above });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const onPointer = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    // Al hacer scroll el botón se mueve: se cierra en vez de quedar flotando.
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`help-tip ${open ? 'open' : ''}`}
        aria-label={t('help.whatIs', { title })}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={(event) => {
          // No marcar/desmarcar la fila al pedir ayuda.
          event.stopPropagation();
          if (pinned) {
            close();
          } else {
            setPinned(true);
            show();
          }
        }}
        onMouseEnter={show}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={show}
        onBlur={() => !pinned && setOpen(false)}
      >
        ?
      </button>
      {open &&
        position &&
        createPortal(
          <div
            id={popoverId}
            role="tooltip"
            className={`help-popover ${position.above ? 'above' : ''}`}
            style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          >
            <strong className="help-popover__title">{title}</strong>
            <div className="help-popover__body">{children}</div>
            {footer && <div className="help-popover__footer">{footer}</div>}
          </div>,
          document.body,
        )}
    </>
  );
}

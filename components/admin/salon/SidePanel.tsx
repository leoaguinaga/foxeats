'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Panel lateral derecho que conserva a la vista la zona que se está editando. */
export function SidePanel({ open, titulo, descripcion, onClose, children, pie, ancho = 380 }: {
  open: boolean;
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
  ancho?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, button:not([data-cerrar])')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        type="button"
        aria-label="Cerrar panel"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--ink)]/30 animate-in fade-in duration-150"
      />
      <div
        ref={ref}
        style={{ maxWidth: ancho }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--linea)] bg-white shadow-[-18px_0_40px_-24px_rgba(22,25,34,0.35)] animate-in slide-in-from-right duration-200 ease-out"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-[17px] font-semibold text-[var(--ink)]">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-[13.5px] text-[var(--pizarra)]">{descripcion}</p>}
          </div>
          <button
            type="button"
            data-cerrar
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 rounded-md p-1.5 text-[var(--pizarra)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {pie && <footer className="flex items-center justify-end gap-2 border-t border-[var(--linea)] px-5 py-3">{pie}</footer>}
      </div>
    </div>
  );
}

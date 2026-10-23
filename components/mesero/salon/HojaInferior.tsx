'use client';

import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Mientras se guarda no se cierra con Esc ni tocando fuera. */
  bloqueada?: boolean;
  titulo: string;
  children: React.ReactNode;
}

/**
 * Hoja que sube desde abajo, con la acción donde está el pulgar. En pantallas
 * anchas queda centrada sobre el borde inferior.
 */
export function HojaInferior({ open, onClose, bloqueada = false, titulo, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloqueada) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, bloqueada, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(22,25,34,.42)] animate-in fade-in duration-150"
      onClick={() => !bloqueada && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[18px] bg-white px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-20px_rgba(22,25,34,.5)] animate-in slide-in-from-bottom-6 duration-200 ease-out sm:mb-6 sm:rounded-[18px]"
      >
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-[#D9D7D0]" />
        {children}
      </div>
    </div>
  );
}

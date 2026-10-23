'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const MOTIVOS_COMUNES = [
  'Demoró mucho',
  'Cliente ya no quiere',
  'Error al tomar el pedido',
  'Cocina sin stock',
  'Cliente cambió de pedido',
];

interface Props {
  open: boolean;
  loading?: boolean;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

export function CancelarRondaDialog({ open, loading, onConfirm, onCancel }: Props) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open) setMotivo('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const motivoLimpio = motivo.trim();
  const puedeConfirmar = motivoLimpio.length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 className="font-bold text-[var(--ink)] text-lg">Cancelar ronda</h2>
          <p className="text-sm text-muted-foreground">
            ¿Por qué se cancela? Se restaurará el stock de bebidas si aplica.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Motivos comunes
          </p>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_COMUNES.map((m) => {
              const seleccionado = motivo === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  disabled={loading}
                  className={[
                    'text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50',
                    seleccionado
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'bg-white text-[var(--ink)] border-border hover:border-[var(--ink)]',
                  ].join(' ')}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Motivo
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Escribe el motivo o elige uno de arriba…"
            rows={2}
            disabled={loading}
            className="w-full text-sm px-3 py-2 rounded-lg border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--alerta)]"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 disabled:opacity-50"
          >
            Volver
          </button>
          <Button
            onClick={() => onConfirm(motivoLimpio)}
            disabled={!puedeConfirmar}
            className="bg-[var(--alerta)] hover:bg-[var(--alerta-hover)] text-white disabled:opacity-40"
          >
            {loading ? '…' : 'Cancelar ronda'}
          </Button>
        </div>
      </div>
    </div>
  );
}

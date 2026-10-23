'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmClass =
    variant === 'destructive'
      ? 'bg-[var(--alerta)] hover:bg-[var(--alerta-hover)] text-white'
      : 'bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 className="font-bold text-[var(--ink)] text-lg">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={`${confirmClass} disabled:opacity-40`}
          >
            {loading ? '…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

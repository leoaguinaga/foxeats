'use client';

import { useState } from 'react';
import { HojaInferior } from '@/components/mesero/salon/HojaInferior';

const MOTIVOS = ['Demoró mucho', 'Ya no quiere', 'Error al pedir'];

/** Hoja inferior para cancelar una ronda: motivo en chips u «Otro» escrito. */
export function CancelarRonda({ open, ronda, guardando, onConfirmar, onCerrar }: {
  open: boolean;
  /** «Ronda 2» */
  ronda: string;
  guardando: boolean;
  onConfirmar: (motivo: string) => void;
  onCerrar: () => void;
}) {
  return (
    <HojaInferior open={open} onClose={onCerrar} bloqueada={guardando} titulo={`Cancelar ${ronda}`}>
      {/* Se monta de nuevo en cada apertura: el motivo arranca vacío. */}
      {open && <Contenido ronda={ronda} guardando={guardando} onConfirmar={onConfirmar} onCerrar={onCerrar} />}
    </HojaInferior>
  );
}

function Contenido({ ronda, guardando, onConfirmar, onCerrar }: {
  ronda: string;
  guardando: boolean;
  onConfirmar: (motivo: string) => void;
  onCerrar: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [otro, setOtro] = useState('');
  const motivo = elegido === 'Otro' ? otro.trim() : elegido ?? '';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] font-semibold text-[var(--ink)]">Cancelar {ronda}</h2>
        <p className="mt-1 text-[13.5px] text-[var(--pizarra)]">Cocina deja de prepararla y se descuenta de la cuenta. ¿Por qué se cancela?</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
        {[...MOTIVOS, 'Otro'].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={elegido === m}
            onClick={() => setElegido(m)}
            className={[
              'h-9 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors',
              elegido === m ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:border-[#C9CBD6]',
            ].join(' ')}
          >
            {m}
          </button>
        ))}
      </div>
      {elegido === 'Otro' && (
        <input
          autoFocus
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          placeholder="Escribe el motivo"
          aria-label="Otro motivo"
          className="h-10 w-full rounded-lg border border-[var(--linea)] px-3 text-[14px] outline-none focus:border-[var(--tinta)] focus:shadow-[0_0_0_3px_var(--tinta-tint)]"
        />
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onCerrar} disabled={guardando} className="h-11 rounded-lg border border-[var(--linea)] bg-white text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)] disabled:opacity-50">
          Volver
        </button>
        <button
          type="button"
          onClick={() => onConfirmar(motivo)}
          disabled={!motivo || guardando}
          className="h-11 rounded-lg bg-[var(--alerta)] text-[14px] font-semibold text-white hover:bg-[var(--alerta-hover)] disabled:opacity-45"
        >
          {guardando ? 'Cancelando…' : 'Cancelar ronda'}
        </button>
      </div>
    </div>
  );
}

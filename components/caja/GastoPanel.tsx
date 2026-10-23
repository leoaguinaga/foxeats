'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, type GastoCaja } from '@/lib/api';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { soles } from '@/components/admin/caja/fechas';
import { limpiarMonto } from './Efectivo';
import { campoCaja } from './Catalogo';

const MOTIVOS = ['Compra de insumos', 'Gas', 'Bolsas y tápers', 'Movilidad', 'Propina delivery'];

/** Gasto pagado con efectivo de la gaveta. Al editar, el monto anterior vuelve a la cuenta del esperado. */
export function GastoPanel({ gasto, enGaveta, onGuardado, onCancelar }: {
  gasto: GastoCaja | null;
  enGaveta: number;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [monto, setMonto] = useState(gasto ? gasto.monto : '');
  const [motivo, setMotivo] = useState(gasto ? gasto.motivo : '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ campo: 'monto' | 'motivo' | null; texto: string } | null>(null);

  const valor = parseFloat(monto || '0') || 0;
  const disponible = enGaveta + (gasto ? parseFloat(gasto.monto) : 0);
  const quedan = disponible - valor;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (valor <= 0) { setError({ campo: 'monto', texto: 'Escribe cuánto salió de la gaveta.' }); return; }
    if (!motivo.trim()) { setError({ campo: 'motivo', texto: 'Escribe en qué se gastó.' }); return; }
    setGuardando(true);
    setError(null);
    try {
      if (gasto) await api.caja.editarGasto(gasto.id, valor, motivo.trim());
      else await api.caja.registrarGasto(valor, motivo.trim());
      toast.success(gasto ? 'Gasto actualizado' : `Gasto de S/ ${soles(valor)} registrado`);
      onGuardado();
    } catch (err) {
      setError({ campo: null, texto: err instanceof Error ? err.message : 'No se pudo guardar el gasto. Intenta de nuevo.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SidePanel
      open
      onClose={onCancelar}
      titulo={gasto ? 'Editar gasto' : 'Registrar gasto'}
      descripcion="Sale en efectivo de la gaveta y se descuenta del esperado al cierre."
      pie={
        <>
          <button type="button" onClick={onCancelar} className="h-10 rounded-lg px-3.5 text-[13.5px] font-semibold text-[var(--pizarra)] hover:bg-[var(--piedra)]">Cancelar</button>
          <button type="submit" form="form-gasto" disabled={guardando} className="h-10 rounded-lg bg-[var(--tinta)] px-4 text-[13.5px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-50">
            {guardando ? 'Guardando…' : gasto ? 'Guardar cambios' : valor > 0 ? `Registrar S/ ${soles(valor)}` : 'Registrar gasto'}
          </button>
        </>
      }
    >
      <form id="form-gasto" onSubmit={guardar} noValidate className="space-y-5 pt-2">
        <div>
          <label htmlFor="gasto-monto" className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">Monto</label>
          <div className={['flex h-14 items-center gap-2.5 rounded-[10px] border bg-white px-4 focus-within:border-[var(--tinta)] focus-within:shadow-[0_0_0_3px_var(--tinta-tint)]', error?.campo === 'monto' ? 'border-[var(--alerta)]' : 'border-[var(--linea)]'].join(' ')}>
            <span className="text-[20px] font-medium text-[var(--pizarra)]" aria-hidden>S/</span>
            <input
              id="gasto-monto"
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={monto}
              onChange={(e) => { setMonto(limpiarMonto(e.target.value)); setError(null); }}
              aria-invalid={error?.campo === 'monto'}
              size={1}
              className="w-full min-w-0 flex-1 bg-transparent text-[28px] font-semibold tracking-[-0.01em] text-[var(--ink)] tabular-nums outline-none placeholder:text-[#B5B7C0]"
            />
          </div>
          {valor > 0 && (
            <p className={['mt-1.5 text-[13px]', quedan < 0 ? 'text-[var(--alerta)]' : 'text-[var(--pizarra)]'].join(' ')}>
              {quedan < 0
                ? `Es más de lo que debería haber en la gaveta (S/ ${soles(disponible)}).`
                : <>En la gaveta quedarán <span className="font-semibold text-[var(--ink)] tabular-nums">S/ {soles(quedan)}</span></>}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="gasto-motivo" className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">En qué se gastó</label>
          <input
            id="gasto-motivo"
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(null); }}
            placeholder="Ej.: 2 balones de gas"
            aria-invalid={error?.campo === 'motivo'}
            className={`${campoCaja} ${error?.campo === 'motivo' ? 'border-[var(--alerta)]' : ''}`}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMotivo(m); setError(null); }}
                className={['rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors', motivo === m ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] text-[var(--pizarra)] hover:text-[var(--ink)]'].join(' ')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error.texto}</p>}
      </form>
    </SidePanel>
  );
}

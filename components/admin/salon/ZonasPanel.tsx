'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Mesa, Zona } from '@/lib/types';
import { SidePanel } from './SidePanel';
import { botonCls, botonPrimarioCls, inputCls } from './controles';

export function ZonasPanel({ open, onClose, zonas, mesas, onCambio }: {
  open: boolean;
  onClose: () => void;
  zonas: Zona[];
  mesas: Mesa[];
  onCambio: (seleccionar?: string) => void;
}) {
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const mesasPorZona = (id: string) => mesas.filter((m) => (m.zonaId ?? zonas[0]?.id) === id).length;

  async function ejecutar(fn: () => Promise<unknown>, ok?: string, seleccionar?: string) {
    setOcupado(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      onCambio(seleccionar);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    const nombre = nueva.trim();
    if (!nombre) return;
    setOcupado(true);
    try {
      const z = await api.zonas.crear({ nombre });
      setNueva('');
      toast.success(`Zona «${z.nombre}» creada`);
      onCambio(z.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la zona');
    } finally {
      setOcupado(false);
    }
  }

  function mover(i: number, d: -1 | 1) {
    const ids = zonas.map((z) => z.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    ejecutar(() => api.zonas.reordenar(ids));
  }

  return (
    <SidePanel
      open={open}
      titulo="Zonas"
      descripcion="El orden es el de las pestañas aquí y en la vista del mesero."
      onClose={onClose}
      pie={<button type="button" onClick={onClose} className={botonPrimarioCls}>Listo</button>}
    >
      <ul className="overflow-hidden rounded-[9px] border border-[var(--linea)]">
        {zonas.map((z, i) => {
          const n = mesasPorZona(z.id);
          const puedeEliminar = zonas.length > 1 && n === 0;
          return (
            <li key={z.id} className="flex items-center gap-2 border-b border-[#EFEDE8] px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <NombreZona key={`${z.id}-${z.nombre}`} zona={z} onGuardar={(nombre) => ejecutar(() => api.zonas.actualizar(z.id, { nombre }))} />
                <p className="mt-0.5 pl-2 text-xs text-[var(--pizarra)]">
                  {z.modo === 'plano' ? 'Plano' : 'Por número'} · {n} mesa{n !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <IconBtn label={`Subir ${z.nombre}`} disabled={i === 0 || ocupado} onClick={() => mover(i, -1)}><ArrowUp className="size-3.5" /></IconBtn>
                <IconBtn label={`Bajar ${z.nombre}`} disabled={i === zonas.length - 1 || ocupado} onClick={() => mover(i, 1)}><ArrowDown className="size-3.5" /></IconBtn>
                <IconBtn
                  label={`Eliminar ${z.nombre}`}
                  title={puedeEliminar ? undefined : zonas.length === 1 ? 'Debe quedar al menos una zona' : 'Mueve o elimina sus mesas primero'}
                  disabled={!puedeEliminar || ocupado}
                  peligro
                  onClick={() => ejecutar(() => api.zonas.eliminar(z.id), `Zona «${z.nombre}» eliminada`)}
                >
                  <Trash2 className="size-3.5" />
                </IconBtn>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-[var(--pizarra)]">Una zona solo se elimina si está vacía. Debe quedar al menos una.</p>

      <form className="mt-5 space-y-2" onSubmit={(e) => { e.preventDefault(); crear(); }}>
        <label htmlFor="zona-nueva" className="block text-xs text-[var(--pizarra)]">Nueva zona</label>
        <div className="flex gap-2">
          <input
            id="zona-nueva"
            value={nueva}
            maxLength={40}
            placeholder="Terraza, Piso 2…"
            onChange={(e) => setNueva(e.target.value)}
            className={inputCls}
          />
          <button type="submit" disabled={!nueva.trim() || ocupado} className={botonCls}>
            <Plus className="size-3.5" aria-hidden /> Crear
          </button>
        </div>
        <p className="text-xs text-[var(--pizarra)]">Las zonas nuevas empiezan en modo «Por número»; puedes activar el plano cuando quieras.</p>
      </form>
    </SidePanel>
  );
}

function NombreZona({ zona, onGuardar }: { zona: Zona; onGuardar: (nombre: string) => void }) {
  const [valor, setValor] = useState(zona.nombre);
  return (
    <input
      aria-label={`Nombre de ${zona.nombre}`}
      value={valor}
      maxLength={40}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        const v = valor.trim();
        if (!v) { setValor(zona.nombre); return; }
        if (v !== zona.nombre) onGuardar(v);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-[var(--ink)] outline-none hover:border-[var(--linea)] focus:border-[var(--tinta)] focus:bg-white"
    />
  );
}

function IconBtn({ label, title, disabled, onClick, peligro, children }: {
  label: string; title?: string; disabled?: boolean; onClick: () => void; peligro?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'grid size-8 place-items-center rounded-md text-[var(--pizarra)] transition-colors disabled:opacity-30',
        peligro ? 'hover:bg-[var(--alerta-tint)] hover:text-[var(--alerta)]' : 'hover:bg-[var(--muted)] hover:text-[var(--ink)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

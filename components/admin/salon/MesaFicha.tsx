'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Mesa, TipoMesa, Zona } from '@/lib/types';
import { etiquetaMesa } from '@/lib/mesas';
import { Campo, EstadoMesaPill, Segmentado, Stepper, botonFantasmaCls, inputCls } from './controles';

/**
 * Datos propios de una mesa (número, personas, zona). Cada cambio se guarda
 * al momento; la posición en el plano va aparte, con «Guardar plano».
 */
export function MesaFicha({ mesa, todas, zonas, onActualizar, onEliminar, children }: {
  mesa: Mesa;
  todas: Mesa[];
  zonas: Zona[];
  onActualizar: (data: Partial<{ numero: number; capacidad: number; zonaId: string; tipo: TipoMesa }>) => Promise<boolean>;
  onEliminar: () => void;
  children?: React.ReactNode;
}) {
  const ocupada = mesa.estado === 'ocupada';
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--ink)]">
          {etiquetaMesa(mesa, todas)}
          {mesa.tipo === 'barra' && <span className="ml-1.5 text-[13px] font-normal text-[var(--pizarra)] tabular-nums">Nº {mesa.numero}</span>}
        </h3>
        <EstadoMesaPill ocupada={ocupada} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumeroMesa key={`${mesa.id}-${mesa.numero}`} mesa={mesa} onGuardar={(numero) => onActualizar({ numero })} />
        <Campo label="Personas">
          <Stepper
            etiqueta="personas"
            value={mesa.capacidad ?? 4}
            min={1}
            max={50}
            onChange={(capacidad) => onActualizar({ capacidad })}
          />
        </Campo>
      </div>
      <Campo
        label="Tipo"
        ayuda={mesa.tipo === 'barra' ? 'Se ve como taburete y el mesero la llama «Barra N». Las comandas usan el número.' : undefined}
      >
        <Segmentado<TipoMesa>
          etiqueta="Tipo de mesa"
          value={mesa.tipo ?? 'mesa'}
          opciones={[{ value: 'mesa', label: 'Mesa' }, { value: 'barra', label: 'Puesto de barra' }]}
          onChange={(tipo) => onActualizar({ tipo })}
        />
      </Campo>
      <Campo
        label="Zona"
        htmlFor={`zona-${mesa.id}`}
        ayuda={zonas.length > 1 ? 'Al cambiarla, la mesa llega sin ubicar al plano de la otra zona.' : undefined}
      >
        <select
          id={`zona-${mesa.id}`}
          value={mesa.zonaId ?? zonas[0]?.id ?? ''}
          onChange={(e) => onActualizar({ zonaId: e.target.value })}
          className={inputCls}
        >
          {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
      </Campo>
      {children}
      <div className="border-t border-[#EFEDE8] pt-3">
        <button
          type="button"
          onClick={onEliminar}
          disabled={ocupada}
          title={ocupada ? 'No se puede eliminar una mesa ocupada' : undefined}
          className={[botonFantasmaCls, '-ml-2 text-[var(--alerta)] hover:bg-[var(--alerta-tint)] hover:text-[var(--alerta)]'].join(' ')}
        >
          <Trash2 className="size-3.5" aria-hidden /> Eliminar mesa
        </button>
        {ocupada && <p className="mt-1 text-xs text-[var(--pizarra)]">Está ocupada: se podrá eliminar cuando se libere.</p>}
      </div>
    </div>
  );
}

function NumeroMesa({ mesa, onGuardar }: { mesa: Mesa; onGuardar: (n: number) => Promise<boolean> }) {
  const [valor, setValor] = useState(String(mesa.numero));

  async function confirmar() {
    const n = parseInt(valor, 10);
    if (!n || n < 1) { setValor(String(mesa.numero)); return; }
    if (n === mesa.numero) return;
    const ok = await onGuardar(n);
    if (!ok) setValor(String(mesa.numero));
  }

  return (
    <Campo label="Número" htmlFor={`num-${mesa.id}`}>
      <input
        id={`num-${mesa.id}`}
        type="number"
        min={1}
        inputMode="numeric"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={inputCls}
      />
    </Campo>
  );
}

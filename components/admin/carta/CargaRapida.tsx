'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CategoriaCarta } from '@/lib/types';
import { botonFantasmaCls, botonPrimarioCls } from '@/components/admin/salon/controles';
import { leerListaPegada, leerPrecio, plural } from './carta';

type Fila = { id: number; nombre: string; precio: string; descripcion: string };

const filaVacia = (id: number): Fila => ({ id, nombre: '', precio: '', descripcion: '' });

/** Filas en línea para cargar varios platos seguidos dentro de una categoría. */
export function CargaRapida({ categoria, nombreInicial, onCerrar, onGuardado }: {
  categoria: CategoriaCarta;
  nombreInicial?: string;
  onCerrar: () => void;
  onGuardado: (n: number) => void;
}) {
  const [filas, setFilas] = useState<Fila[]>([{ ...filaVacia(1), nombre: nombreInicial ?? '' }]);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const sigId = useRef(2);
  const raiz = useRef<HTMLDivElement>(null);
  const enfocar = useRef<{ id: number; campo: keyof Fila } | null>({ id: 1, campo: nombreInicial ? 'precio' : 'nombre' });

  useEffect(() => {
    if (!enfocar.current) return;
    const { id, campo } = enfocar.current;
    raiz.current?.querySelector<HTMLInputElement>(`[data-fila="${id}"][data-campo="${campo}"]`)?.focus();
    enfocar.current = null;
  });

  const conDatos = filas.filter((f) => f.nombre.trim() || f.precio.trim() || f.descripcion.trim());
  const errorDe = (f: Fila): string | null => {
    if (!f.nombre.trim() && !f.precio.trim() && !f.descripcion.trim()) return null;
    if (!f.nombre.trim()) return 'falta el nombre';
    if (!f.precio.trim()) return 'falta el precio';
    if (leerPrecio(f.precio) === null) return 'el precio debe ser un número mayor a 0';
    return null;
  };
  const validas = conDatos.filter((f) => !errorDe(f));
  const primerError = filas.findIndex((f) => errorDe(f));

  function cambiar(id: number, campo: 'nombre' | 'precio' | 'descripcion', valor: string) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function nuevaFila(despuesDe: number) {
    const id = sigId.current++;
    setFilas((prev) => {
      const i = prev.findIndex((f) => f.id === despuesDe);
      const copia = [...prev];
      copia.splice(i + 1, 0, filaVacia(id));
      return copia;
    });
    enfocar.current = { id, campo: 'nombre' };
  }

  function quitar(id: number) {
    setFilas((prev) => {
      const resto = prev.filter((f) => f.id !== id);
      if (resto.length) return resto;
      const nid = sigId.current++;
      enfocar.current = { id: nid, campo: 'nombre' };
      return [filaVacia(nid)];
    });
  }

  function alPegar(e: React.ClipboardEvent<HTMLInputElement>, fila: Fila) {
    const texto = e.clipboardData.getData('text');
    if (!/\r?\n/.test(texto.trim()) && !texto.includes('\t')) return;
    e.preventDefault();
    const leidas = leerListaPegada(texto);
    if (!leidas.length) return;
    setFilas((prev) => {
      const i = prev.findIndex((f) => f.id === fila.id);
      const nuevas = leidas.map((l) => ({ id: sigId.current++, ...l }));
      const copia = [...prev];
      // La fila donde se pegó se reemplaza si estaba vacía.
      const vacia = !fila.nombre.trim() && !fila.precio.trim();
      copia.splice(i, vacia ? 1 : 0, ...nuevas);
      return copia;
    });
    toast.success(`${plural(leidas.length, 'línea leída', 'líneas leídas')}. Revisa los precios antes de guardar.`);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>, fila: Fila) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); guardar(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const i = filas.findIndex((f) => f.id === fila.id);
      const siguiente = filas[i + 1];
      if (siguiente) enfocar.current = { id: siguiente.id, campo: 'nombre' };
      else if (fila.nombre.trim() || fila.precio.trim()) nuevaFila(fila.id);
      setFilas((p) => [...p]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (conDatos.length === 0) onCerrar();
    }
  }

  async function guardar() {
    setIntentado(true);
    if (primerError >= 0) {
      const f = filas[primerError];
      enfocar.current = { id: f.id, campo: !f.nombre.trim() ? 'nombre' : 'precio' };
      setFilas((p) => [...p]);
      return;
    }
    if (!validas.length) { toast.error('Escribe al menos un plato con nombre y precio'); return; }
    setGuardando(true);
    try {
      await api.admin.crearPlatosBulk({
        categoriaId: categoria.id,
        platos: validas.map((f) => ({
          nombre: f.nombre.trim(),
          precio: leerPrecio(f.precio)!.toFixed(2),
          descripcion: f.descripcion.trim() || undefined,
        })),
      });
      toast.success(`${plural(validas.length, 'plato agregado', 'platos agregados')} a ${categoria.nombre}`);
      onGuardado(validas.length);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron guardar los platos');
    } finally {
      setGuardando(false);
    }
  }

  const entrada = 'h-9 w-full min-w-0 rounded-md border border-[var(--linea)] bg-white px-2.5 text-[13.5px] text-[var(--ink)] outline-none transition-colors placeholder:text-[#A9ABB4] focus:border-[var(--tinta)] focus:ring-2 focus:ring-[var(--tinta)]/15';

  return (
    <div
      ref={raiz}
      className="overflow-hidden rounded-b-[10px] border-t-[1.5px] border-[var(--tinta)] bg-white animate-in fade-in slide-in-from-top-1 duration-150"
      aria-label={`Agregar platos a ${categoria.nombre}`}
      role="group"
    >
      <div className="hidden grid-cols-[24px_minmax(0,1.2fr)_112px_minmax(0,1fr)_32px] gap-2 bg-[#FAF9F6] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--pizarra)] md:grid">
        <span /><span>Nombre</span><span className="text-right">Precio</span><span>Descripción (opcional)</span><span />
      </div>
      <ol>
        {filas.map((f, i) => {
          const err = intentado ? errorDe(f) : null;
          const precioMal = !!err && err.includes('precio');
          const nombreMal = err === 'falta el nombre';
          return (
            <li key={f.id} className="grid grid-cols-[24px_minmax(0,1fr)_96px_32px] items-center gap-2 border-b border-[#EFEDE8] px-3 py-2 md:grid-cols-[24px_minmax(0,1.2fr)_112px_minmax(0,1fr)_32px]">
              <span className="text-center text-xs tabular-nums text-[#A9ABB4]">{i + 1}</span>
              <input
                data-fila={f.id}
                data-campo="nombre"
                aria-label={`Nombre del plato ${i + 1}`}
                aria-invalid={nombreMal}
                placeholder="Nombre del plato"
                value={f.nombre}
                onChange={(e) => cambiar(f.id, 'nombre', e.target.value)}
                onKeyDown={(e) => teclas(e, f)}
                onPaste={(e) => alPegar(e, f)}
                className={`${entrada} ${nombreMal ? 'border-[var(--alerta)] bg-[var(--alerta-tint)]' : ''}`}
              />
              <div className={`relative ${precioMal ? '[&>input]:border-[var(--alerta)] [&>input]:bg-[var(--alerta-tint)]' : ''}`}>
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] text-[var(--pizarra)]">S/</span>
                <input
                  data-fila={f.id}
                  data-campo="precio"
                  aria-label={`Precio del plato ${i + 1}`}
                  aria-invalid={precioMal}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={f.precio}
                  onChange={(e) => cambiar(f.id, 'precio', e.target.value)}
                  onKeyDown={(e) => teclas(e, f)}
                  className={`${entrada} pl-7 text-right tabular-nums`}
                />
              </div>
              <input
                data-fila={f.id}
                data-campo="descripcion"
                aria-label={`Descripción del plato ${i + 1}`}
                placeholder="Descripción"
                value={f.descripcion}
                onChange={(e) => cambiar(f.id, 'descripcion', e.target.value)}
                onKeyDown={(e) => teclas(e, f)}
                className={`${entrada} col-start-2 col-end-4 md:col-auto`}
              />
              <button
                type="button"
                onClick={() => quitar(f.id)}
                aria-label={`Quitar fila ${i + 1}`}
                className="row-start-1 col-start-4 grid size-8 place-items-center rounded-md text-[#A9ABB4] hover:bg-[var(--muted)] hover:text-[var(--ink)] md:row-auto md:col-auto"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F6] px-3 py-2.5 text-[12.5px] text-[var(--pizarra)]">
        <p className="m-0 min-w-0">
          {intentado && primerError >= 0 ? (
            <span role="alert" className="font-medium text-[var(--alerta)]">Fila {primerError + 1}: {errorDe(filas[primerError])}</span>
          ) : (
            <span className="hidden md:inline">
              <Tecla>Tab</Tecla> siguiente campo · <Tecla>Enter</Tecla> nueva fila · <Tecla>⌘</Tecla><Tecla>Enter</Tecla> guardar · pega una lista para llenar varias filas
            </span>
          )}
        </p>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCerrar} className={botonFantasmaCls}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando || conDatos.length === 0} className={botonPrimarioCls}>
            {guardando ? 'Guardando…' : validas.length > 0 ? `Guardar ${plural(validas.length, 'plato', 'platos')}` : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-b-2 border-[var(--linea)] bg-white px-1 font-sans text-[11px] font-semibold text-[var(--ink)]">
      {children}
    </kbd>
  );
}

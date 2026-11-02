'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, FolderInput, MoreHorizontal, Pencil, RotateCcw, Undo2 } from 'lucide-react';
import type { CategoriaCarta, PlatoCarta } from '@/lib/types';
import { Interruptor } from './Interruptor';
import { formatoPrecio, leerPrecio, sinVincular } from './carta';
import { plural } from '../stock/stock';

// Columnas compartidas por la cabecera y las filas de cada categoría (escritorio).
export const columnasFila = 'md:grid-cols-[minmax(0,1fr)_112px_96px_128px_40px]';

export function FilaPlato({ plato, categoria, categorias, ocupado, onEditar, onDuplicar, onMover, onDisponible, onActivo, onPrecio }: {
  plato: PlatoCarta;
  categoria: CategoriaCarta | undefined;
  categorias: CategoriaCarta[];
  ocupado: boolean;
  onEditar: () => void;
  onDuplicar: () => void;
  onMover: (categoriaId: string) => void;
  onDisponible: (v: boolean) => void;
  onActivo: (v: boolean) => void;
  onPrecio: (precio: number) => Promise<boolean>;
}) {
  const retirado = !plato.activo;
  const agotado = plato.activo && !plato.disponible;

  return (
    <div
      className={[
        'group/fila grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-[#EFEDE8] px-3.5 py-2.5 last:border-b-0 md:gap-3',
        columnasFila,
        'transition-colors hover:bg-[#FAF9F6]',
      ].join(' ')}
    >
      <div className="min-w-0">
        <button
          type="button"
          onClick={onEditar}
          className={[
            'block max-w-full truncate rounded-sm text-left font-medium underline-offset-[3px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
            agotado || retirado ? 'text-[var(--pizarra)]' : 'text-[var(--ink)]',
          ].join(' ')}
        >
          {plato.nombre}
        </button>
        {plato.descripcion && (
          <p className="truncate text-[12.5px] text-[var(--pizarra)]">{plato.descripcion}</p>
        )}
      </div>

      <PrecioEditable precio={plato.precio} nombre={plato.nombre} onGuardar={onPrecio} />

      <div className="col-span-2 flex items-center gap-3 md:contents">
        <Stock plato={plato} categoria={categoria} />
        <div className="md:order-none">
          {retirado ? (
            <button
              type="button"
              onClick={() => onActivo(true)}
              disabled={ocupado}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-[12.5px] font-medium text-[var(--tinta)] hover:underline disabled:opacity-45"
            >
              <Undo2 className="size-3.5" aria-hidden /> Volver a la carta
            </button>
          ) : (
            <Interruptor
              activo={plato.disponible}
              disabled={ocupado}
              etiqueta={`${plato.nombre} disponible hoy`}
              onChange={onDisponible}
            />
          )}
        </div>
        <div className="ml-auto md:ml-0 md:justify-self-center">
          <MenuFila
            plato={plato}
            categorias={categorias}
            onEditar={onEditar}
            onDuplicar={onDuplicar}
            onMover={onMover}
            onActivo={onActivo}
          />
        </div>
      </div>
    </div>
  );
}

function Stock({ plato, categoria }: { plato: PlatoCarta; categoria: CategoriaCarta | undefined }) {
  if (!categoria?.descuentaStock) return <span className="hidden md:block" />;
  if (sinVincular(plato, categoria)) {
    return <span className="text-[12.5px] font-medium text-[var(--aviso)]" title="Este plato no descuenta stock: vincúlalo a un insumo">Sin vincular</span>;
  }
  if (plato.stockActual === null) return <span className="hidden md:block" />;
  const n = plato.stockActual;
  const unidad = abreviar(plato.nombreUnidadMinima, n);
  const cls = n <= 0 ? 'font-medium text-[var(--alerta)]' : n <= 5 ? 'font-medium text-[var(--aviso)]' : 'text-[var(--pizarra)]';
  return <span className={`text-[12.5px] tabular-nums ${cls}`}>{n} {unidad}</span>;
}

function abreviar(unidad: string | null, n: number) {
  if (!unidad) return '';
  const u = unidad.toLowerCase();
  if (u.startsWith('botella')) return 'bot.';
  if (u.startsWith('unidad')) return 'u.';
  return plural(u, n);
}

function PrecioEditable({ precio, nombre, onGuardar }: {
  precio: string;
  nombre: string;
  onGuardar: (precio: number) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [error, setError] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) inputRef.current?.select();
  }, [editando]);

  async function confirmar() {
    if (guardando) return;
    const n = leerPrecio(valor);
    if (n === null) { setError(true); inputRef.current?.focus(); return; }
    if (n.toFixed(2) === formatoPrecio(precio)) { setEditando(false); return; }
    setGuardando(true);
    const ok = await onGuardar(n);
    setGuardando(false);
    if (ok) setEditando(false);
  }

  if (editando) {
    return (
      <div className="flex justify-end">
        <label className="sr-only" htmlFor={`precio-${nombre}`}>Precio de {nombre}</label>
        <div className={[
          'flex h-8 w-[104px] items-center rounded-md border bg-white pl-2 pr-1 text-sm',
          error ? 'border-[var(--alerta)] bg-[var(--alerta-tint)]' : 'border-[var(--tinta)] ring-2 ring-[var(--tinta)]/15',
        ].join(' ')}>
          <span className="text-[12.5px] text-[var(--pizarra)]">S/</span>
          <input
            ref={inputRef}
            id={`precio-${nombre}`}
            inputMode="decimal"
            value={valor}
            disabled={guardando}
            aria-invalid={error}
            onChange={(e) => { setValor(e.target.value); setError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditando(false); }
            }}
            onBlur={() => { if (!error) confirmar(); }}
            className="w-full min-w-0 bg-transparent text-right font-semibold tabular-nums text-[var(--ink)] outline-none"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setValor(formatoPrecio(precio)); setError(false); setEditando(true); }}
      title="Cambiar precio"
      className="justify-self-end rounded-sm text-right font-semibold tabular-nums text-[var(--ink)] decoration-[var(--tinta)] decoration-[1.5px] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
    >
      <span className="mr-0.5 font-normal text-[var(--pizarra)]">S/</span>{formatoPrecio(precio)}
    </button>
  );
}

function MenuFila({ plato, categorias, onEditar, onDuplicar, onMover, onActivo }: {
  plato: PlatoCarta;
  categorias: CategoriaCarta[];
  onEditar: () => void;
  onDuplicar: () => void;
  onMover: (categoriaId: string) => void;
  onActivo: (v: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<'acciones' | 'mover'>('acciones');
  const ref = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); botonRef.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const sig = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[sig]?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla, true); };
  }, [abierto]);

  useEffect(() => {
    if (abierto) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [abierto, vista]);

  function elegir(fn: () => void) {
    setAbierto(false);
    fn();
  }

  const itemCls = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13.5px] text-[var(--ink)] outline-none hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)]';
  const otras = categorias.filter((c) => c.id !== (plato.categoriaId || plato.categoria?.id));

  return (
    <div ref={ref} className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Acciones de ${plato.nombre}`}
        onClick={() => { setVista('acciones'); setAbierto((v) => !v); }}
        className={[
          'grid size-8 place-items-center rounded-md text-[var(--pizarra)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--tinta)]',
          abierto ? 'bg-[var(--muted)] text-[var(--ink)]' : '',
        ].join(' ')}
      >
        <MoreHorizontal className="size-4" strokeWidth={1.9} />
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label={`Acciones de ${plato.nombre}`}
          className="absolute right-0 top-9 z-30 w-56 origin-top-right rounded-[9px] border border-[var(--linea)] bg-white p-1 shadow-[0_14px_30px_-12px_rgba(22,25,34,0.3)] animate-in fade-in zoom-in-95 duration-100"
        >
          {vista === 'acciones' ? (
            <>
              <button role="menuitem" className={itemCls} onClick={() => elegir(onEditar)}>
                <Pencil className="size-3.5 text-[var(--pizarra)]" strokeWidth={1.9} /> Editar
              </button>
              <button role="menuitem" className={itemCls} onClick={() => elegir(onDuplicar)}>
                <Copy className="size-3.5 text-[var(--pizarra)]" strokeWidth={1.9} /> Duplicar
              </button>
              {otras.length > 0 && (
                <button role="menuitem" className={itemCls} onClick={() => setVista('mover')}>
                  <FolderInput className="size-3.5 text-[var(--pizarra)]" strokeWidth={1.9} /> Mover a categoría…
                </button>
              )}
              <div className="my-1 border-t border-[#EFEDE8]" />
              {plato.activo ? (
                <button role="menuitem" className={`${itemCls} !text-[var(--alerta)] hover:!bg-[var(--alerta-tint)] focus-visible:!bg-[var(--alerta-tint)]`} onClick={() => elegir(() => onActivo(false))}>
                  Retirar de la carta
                </button>
              ) : (
                <button role="menuitem" className={itemCls} onClick={() => elegir(() => onActivo(true))}>
                  <RotateCcw className="size-3.5 text-[var(--pizarra)]" strokeWidth={1.9} /> Volver a la carta
                </button>
              )}
            </>
          ) : (
            <>
              <button role="menuitem" className={`${itemCls} !text-[var(--pizarra)]`} onClick={() => setVista('acciones')}>
                <ArrowLeft className="size-3.5" strokeWidth={1.9} /> Mover a…
              </button>
              <div className="my-1 border-t border-[#EFEDE8]" />
              <div className="max-h-64 overflow-y-auto">
                {otras.map((c) => (
                  <button key={c.id} role="menuitem" className={itemCls} onClick={() => elegir(() => onMover(c.id))}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

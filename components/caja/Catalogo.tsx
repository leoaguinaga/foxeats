'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CategoriaCarta, PlatoCarta } from '@/lib/types';
import { soles } from '@/components/admin/caja/fechas';

export const campoCaja =
  'h-10 w-full rounded-lg border border-[var(--linea)] bg-white px-3 text-[14px] text-[var(--ink)] caret-[var(--tinta)] outline-none placeholder:text-[#8A8D98] focus:border-[var(--tinta)] focus:shadow-[0_0_0_3px_var(--tinta-tint)]';

/** Buscador, categorías de la carta y tarjetas de producto; lo comparten el pedido nuevo y el cobro. */
export function Catalogo({ productos, cantidades, onAgregar, buscarRef, rejilla = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' }: {
  productos: PlatoCarta[];
  cantidades: Map<string, number>;
  onAgregar: (p: PlatoCarta) => void;
  buscarRef?: RefObject<HTMLInputElement | null>;
  rejilla?: string;
}) {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [masPedidos, setMasPedidos] = useState<string[]>([]);
  // null = todavía no se eligió: arranca en «Más pedidos» si hay datos, si no en «Todo».
  const [elegida, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api.categorias.list().then(setCategorias).catch(() => {});
    api.caja.masPedidos().then(setMasPedidos).catch(() => {});
  }, []);

  const visibles = useMemo(() => productos.filter((p) => p.activo), [productos]);

  // Solo las categorías con productos, en el orden de la carta.
  const cats = useMemo(() => {
    const usadas = new Set(visibles.map((p) => p.categoriaId));
    return categorias.filter((c) => c.activo && usadas.has(c.id)).sort((a, b) => a.orden - b.orden);
  }, [categorias, visibles]);

  const populares = useMemo(
    () => masPedidos.map((id) => visibles.find((p) => p.id === id)).filter((p): p is PlatoCarta => !!p),
    [masPedidos, visibles],
  );
  const categoria = elegida ?? (populares.length >= 4 ? 'mas' : 'todo');

  const q = busqueda.trim().toLowerCase();
  // Al buscar se busca en toda la carta, sin importar la categoría elegida.
  const lista = q
    ? visibles.filter((p) => p.nombre.toLowerCase().includes(q))
    : categoria === 'mas'
      ? populares
      : visibles.filter((p) => categoria === 'todo' || p.categoriaId === categoria);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar plato o bebida</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8D98]" strokeWidth={1.9} aria-hidden />
        <input
          ref={buscarRef}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato o bebida"
          className={`${campoCaja} pl-9`}
        />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[var(--piedra)]">
            <X className="size-4" strokeWidth={1.9} />
          </button>
        )}
      </label>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
        {[...(populares.length >= 4 ? [{ id: 'mas', nombre: 'Más pedidos' }] : []), { id: 'todo', nombre: 'Todo' }, ...cats].map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={!q && categoria === c.id}
            onClick={() => { setCategoria(c.id); setBusqueda(''); }}
            className={[
              'rounded-full border px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
              !q && categoria === c.id
                ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white'
                : 'border-[var(--linea)] bg-white text-[var(--pizarra)] hover:border-[#C9CBD6] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="rounded-[10px] border border-[var(--linea)] bg-white px-4 py-10 text-center text-[14px] text-[var(--pizarra)]">
          {q ? `Nada coincide con «${busqueda.trim()}».` : 'No hay productos en esta categoría.'}
        </p>
      ) : (
        <ul className={`grid gap-2 pt-1 ${rejilla}`}>
          {lista.map((p) => {
            const n = cantidades.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={!p.disponible}
                  onClick={() => onAgregar(p)}
                  className={[
                    'relative flex min-h-[68px] w-full flex-col justify-between gap-1.5 rounded-[10px] border bg-white px-3 py-2.5 text-left transition-[border-color,box-shadow,background-color] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                    !p.disponible
                      ? 'cursor-not-allowed border-[var(--linea)] bg-[#FBFAF7]'
                      : n > 0
                        ? 'border-[var(--tinta)] shadow-[inset_0_0_0_1px_var(--tinta)]'
                        : 'border-[var(--linea)] hover:border-[#C9CBD6] hover:shadow-[0_2px_6px_-2px_rgba(22,25,34,0.12)]',
                  ].join(' ')}
                >
                  <span className={['line-clamp-2 text-[13.5px] leading-snug font-semibold', p.disponible ? 'text-[var(--ink)]' : 'text-[#8A8D98]'].join(' ')}>
                    {p.nombre}
                  </span>
                  {p.disponible
                    ? <span className="text-[13px] text-[var(--pizarra)] tabular-nums">S/ {soles(p.precio)}</span>
                    : <span className="text-[12px] font-semibold text-[var(--aviso)]">Agotado</span>}
                  {n > 0 && (
                    <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--aji)] px-1.5 text-[12.5px] font-bold text-[var(--ink)] shadow-[0_2px_4px_rgba(22,25,34,0.2)] tabular-nums">
                      {n}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

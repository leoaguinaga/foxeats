'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CategoriaCarta, PlatoCarta, PromocionVigente } from '@/lib/types';
import { etiquetaDescuento, precioConPromo } from '@/lib/promociones';
import { soles } from '@/components/admin/caja/fechas';
import { AVISO_QUEDAN, campoCaja } from '@/components/caja/Catalogo';
import { Interruptor } from '@/components/admin/carta/Interruptor';
import { PromosAhora } from '@/components/mesero/PromosAhora';

type Filtro = 'todos' | 'faltan';

const agotado = (p: PlatoCarta) => !p.disponible || (p.quedan !== null && p.quedan <= 0);

/**
 * Carta del mesero: para responder «¿hay ceviche?» y avisar cuando algo se
 * acabó. Lista densa; los platos sin insumo con stock llevan el interruptor
 * Hay / No hay, que guarda al momento.
 */
export default function CartaPage() {
  const [platos, setPlatos] = useState<PlatoCarta[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [promos, setPromos] = useState<PromocionVigente[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todo');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const cargar = useCallback(() => {
    api.menu.list().then(setPlatos).catch(() => {});
    api.promociones.vigentes().then(setPromos).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    api.categorias.list().then(setCategorias).catch(() => {});
    const id = setInterval(cargar, 10_000);
    return () => clearInterval(id);
  }, [cargar]);

  const promoPorPlato = useMemo(() => {
    const m = new Map<string, PromocionVigente>();
    for (const pr of promos) for (const id of pr.platoCartaIds) if (!m.has(id)) m.set(id, pr);
    return m;
  }, [promos]);

  const activos = useMemo(() => (platos ?? []).filter((p) => p.activo), [platos]);
  const cats = useMemo(() => {
    const usadas = new Set(activos.map((p) => p.categoriaId));
    return categorias.filter((c) => c.activo && usadas.has(c.id)).sort((a, b) => a.orden - b.orden);
  }, [categorias, activos]);

  async function cambiar(plato: PlatoCarta, disponible: boolean) {
    setGuardando(plato.id);
    setPlatos((ps) => ps?.map((p) => (p.id === plato.id ? { ...p, disponible } : p)) ?? null);
    try {
      await api.menu.toggleDisponible(plato.id, disponible);
      toast.success(`${plato.nombre}: ${disponible ? 'hay' : 'no hay'}`);
    } catch (err) {
      setPlatos((ps) => ps?.map((p) => (p.id === plato.id ? { ...p, disponible: !disponible } : p)) ?? null);
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
    }
  }

  if (!platos) {
    return <div className="flex h-64 items-center justify-center text-[14px] text-[var(--pizarra)]">Cargando carta…</div>;
  }

  const faltan = activos.filter(agotado).length;
  const q = busqueda.trim().toLowerCase();
  const lista = activos.filter((p) => {
    if (filtro === 'faltan' && !agotado(p)) return false;
    // Al buscar se busca en toda la carta, como en el pedido.
    if (q) return p.nombre.toLowerCase().includes(q);
    return categoria === 'todo' || p.categoriaId === categoria;
  });
  const grupos = cats
    .map((c) => ({ c, platos: lista.filter((p) => p.categoriaId === c.id) }))
    .filter((g) => g.platos.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4 md:px-6 md:py-5">
      <div>
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-[var(--ink)]">Carta</h1>
        <p className="text-[13.5px] text-[var(--pizarra)] tabular-nums">
          {activos.length} {activos.length === 1 ? 'plato' : 'platos'} · {faltan} {faltan === 1 ? 'no disponible' : 'no disponibles'}
        </p>
      </div>

      <div className="sticky top-[56px] z-10 -mx-4 space-y-2.5 bg-[var(--piedra)] px-4 py-2 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Buscar plato o bebida</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8D98]" strokeWidth={1.9} aria-hidden />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar plato o bebida" className={`${campoCaja} pl-9`} />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda" className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[var(--piedra)]">
                <X className="size-4" strokeWidth={1.9} />
              </button>
            )}
          </label>
          <div role="radiogroup" aria-label="Qué platos ver" className="inline-flex rounded-lg bg-[#ECEBE6] p-0.5 text-[13.5px]">
            {([['todos', 'Todos'], ['faltan', 'No disponibles']] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filtro === k}
                onClick={() => setFiltro(k)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
                  filtro === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
                ].join(' ')}
              >
                {l}
                {k === 'faltan' && faltan > 0 && (
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--aviso)] px-1 text-[11px] font-bold text-white tabular-nums">{faltan}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
          {[{ id: 'todo', nombre: 'Todo' }, ...cats].map((c) => (
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
      </div>

      <PromosAhora promos={promos} />

      {grupos.length === 0 ? (
        <p className="rounded-[10px] border border-[var(--linea)] bg-white px-4 py-10 text-center text-[14px] text-[var(--pizarra)]">
          {q ? `Nada coincide con «${busqueda.trim()}».` : filtro === 'faltan' ? 'Hay de todo: ningún plato falta.' : 'No hay platos en esta categoría.'}
        </p>
      ) : (
        <div className="space-y-5 pt-1">
          {grupos.map(({ c, platos: ps }) => (
            <section key={c.id} aria-label={c.nombre}>
              <h2 className="mb-1.5 text-[15px] font-semibold text-[var(--ink)]">{c.nombre}</h2>
              <ul className="divide-y divide-[var(--linea)] overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
                {ps.map((p) => (
                  <Fila key={p.id} plato={p} promo={promoPorPlato.get(p.id)} guardando={guardando === p.id} onCambiar={(v) => cambiar(p, v)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Fila({ plato, promo, guardando, onCambiar }: {
  plato: PlatoCarta;
  promo?: PromocionVigente;
  guardando: boolean;
  onCambiar: (disponible: boolean) => void;
}) {
  const falta = agotado(plato);
  const precio = parseFloat(plato.precio);

  return (
    <li className="flex min-h-[52px] items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className={['truncate text-[14px] font-semibold', falta ? 'text-[#8A8D98]' : 'text-[var(--ink)]'].join(' ')}>{plato.nombre}</p>
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-[var(--pizarra)] tabular-nums">
          {promo ? (
            <>
              <s className="text-[12px]">S/ {soles(precio)}</s>
              <span className="font-semibold text-[var(--ink)]">S/ {soles(precioConPromo(precio, promo))}</span>
              <span title={promo.nombre} className="rounded bg-[var(--aji)] px-1 text-[10.5px] leading-4 font-bold text-[var(--ink)]">{etiquetaDescuento(promo)}</span>
            </>
          ) : <>S/ {soles(precio)}</>}
        </p>
      </div>
      {plato.quedan !== null ? (
        // Platos con insumo con stock: el estado lo da el stock, no se toca desde aquí.
        plato.quedan <= 0
          ? <span className="shrink-0 text-[12.5px] font-semibold text-[var(--aviso)]">Agotado · stock</span>
          : (
            <span className={['shrink-0 text-[12.5px] tabular-nums', plato.quedan <= AVISO_QUEDAN ? 'font-semibold text-[var(--aviso)]' : 'text-[var(--pizarra)]'].join(' ')}>
              {plato.quedan === 1 ? 'Queda 1' : `Quedan ${plato.quedan}`}
            </span>
          )
      ) : (
        <Interruptor activo={plato.disponible} onChange={onCambiar} disabled={guardando} etiqueta={`${plato.nombre}: hay`} textoSi="Hay" textoNo="No hay" />
      )}
    </li>
  );
}

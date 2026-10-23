'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChefHat, Package, Plus, RotateCcw, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CategoriaCarta, PlatoCarta } from '@/lib/types';
import { Segmentado, botonCls, botonPrimarioCls } from '@/components/admin/salon/controles';
import { FilaPlato, columnasFila } from '@/components/admin/carta/FilaPlato';
import { CargaRapida } from '@/components/admin/carta/CargaRapida';
import { PlatoPanel, type PanelPlato } from '@/components/admin/carta/PlatoPanel';
import { CategoriasPanel } from '@/components/admin/carta/CategoriasPanel';
import { type FiltroCarta, categoriaDe, pasaFiltro, plural, sinVincular } from '@/components/admin/carta/carta';

export default function AdminCartaPage() {
  const [platos, setPlatos] = useState<PlatoCarta[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroCarta>('carta');
  const [carga, setCarga] = useState<{ categoriaId: string; nombre?: string } | null>(null);
  const [panel, setPanel] = useState<PanelPlato | null>(null);
  const [panelCategorias, setPanelCategorias] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [activa, setActiva] = useState<string | null>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const [ps, cs] = await Promise.all([api.platos.listAdmin(), api.categorias.list()]);
      setPlatos(ps);
      setCategorias(cs);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar();
    const id = setInterval(cargar, 30000);
    return () => clearInterval(id);
  }, [cargar]);

  // «/» enfoca el buscador, como en el resto del panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || t.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      buscador.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const enCarta = platos.filter((p) => p.activo);
  const agotados = enCarta.filter((p) => !p.disponible).length;
  const retirados = platos.length - enCarta.length;

  const conteo = useMemo(() => {
    const r: Record<string, number> = {};
    for (const p of platos) if (p.activo) r[categoriaDe(p)] = (r[categoriaDe(p)] ?? 0) + 1;
    return r;
  }, [platos]);
  const sinVincularPor = useMemo(() => {
    const r: Record<string, number> = {};
    for (const p of platos) {
      const id = categoriaDe(p);
      if (sinVincular(p, catPorId.get(id))) r[id] = (r[id] ?? 0) + 1;
    }
    return r;
  }, [platos, catPorId]);

  const q = busqueda.trim().toLowerCase();
  const visibles = platos.filter((p) =>
    pasaFiltro(p, filtro) &&
    (!q || p.nombre.toLowerCase().includes(q) || (p.descripcion ?? '').toLowerCase().includes(q)),
  );
  // Sin búsqueda ni filtro se muestran todas las categorías, también las vacías, para ver qué falta cargar.
  const mostrarVacias = !q && filtro === 'carta';
  const secciones = categorias
    .map((c) => ({ cat: c, items: visibles.filter((p) => categoriaDe(p) === c.id) }))
    .filter((s) => s.items.length > 0 || mostrarVacias || carga?.categoriaId === s.cat.id);
  const ordenVisible = secciones.flatMap((s) => s.items);

  // Índice: marca la categoría que está a la vista.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-categoria]'));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const vista = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vista) setActiva(vista.target.getAttribute('data-categoria'));
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [secciones.length, filtro, q]);

  function irA(id: string) {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
    setActiva(id);
  }

  // ── Acciones sobre un plato ──────────────────────────────
  function reemplazar(p: PlatoCarta) {
    setPlatos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  }

  async function cambiarDisponible(p: PlatoCarta, disponible: boolean) {
    reemplazar({ ...p, disponible });
    try {
      await api.menu.toggleDisponible(p.id, disponible);
    } catch (err) {
      reemplazar(p);
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar la disponibilidad');
    }
  }

  async function cambiarActivo(p: PlatoCarta, activo: boolean, conDeshacer = true) {
    setOcupado(p.id);
    reemplazar({ ...p, activo });
    try {
      await api.admin.toggleActivoPlato(p.id, activo);
      if (!activo && conDeshacer) {
        toast((t) => (
          <span className="flex items-center gap-3 text-sm">
            «{p.nombre}» retirado de la carta
            <button
              type="button"
              className="font-semibold text-[var(--tinta)] underline underline-offset-2"
              onClick={() => { toast.dismiss(t.id); cambiarActivo({ ...p, activo: false }, true, false); }}
            >
              Deshacer
            </button>
          </span>
        ), { duration: 6000 });
      } else if (activo) {
        toast.success(`«${p.nombre}» volvió a la carta`);
      }
    } catch (err) {
      reemplazar(p);
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el plato');
    } finally {
      setOcupado(null);
    }
  }

  async function cambiarPrecio(p: PlatoCarta, precio: number): Promise<boolean> {
    try {
      await api.admin.editarPlato(p.id, { precio: precio.toFixed(2) });
      reemplazar({ ...p, precio: precio.toFixed(2) });
      toast.success(`${p.nombre}: S/ ${precio.toFixed(2)}`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el precio');
      return false;
    }
  }

  async function moverA(p: PlatoCarta, categoriaId: string) {
    const cat = catPorId.get(categoriaId);
    try {
      await api.admin.editarPlato(p.id, { categoriaId });
      toast.success(`«${p.nombre}» movido a ${cat?.nombre ?? 'otra categoría'}`);
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo mover el plato');
    }
  }

  const cerrarPanel = useCallback(() => setPanel(null), []);
  const cerrarCategorias = useCallback(() => setPanelCategorias(false), []);

  function navegar(dir: -1 | 1) {
    if (panel?.modo !== 'editar') return;
    const i = ordenVisible.findIndex((p) => p.id === panel.plato.id);
    const sig = ordenVisible[i + dir];
    if (sig) setPanel({ modo: 'editar', plato: sig });
  }

  // ── Render ───────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-5 md:px-8 md:py-6" aria-busy>
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-10 w-full max-w-md animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-80 w-full animate-pulse rounded-[10px] bg-[var(--muted)]" />
      </div>
    );
  }

  if (error && categorias.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Carta</h1>
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--aviso)]/30 bg-[var(--aviso-tint)] px-4 py-3 text-sm text-[#7a3c08]">
          No se pudo cargar la carta. Revisa que el servidor esté en marcha.
          <button type="button" onClick={() => cargar()} className={botonCls}><RotateCcw className="size-3.5" aria-hidden /> Reintentar</button>
        </div>
      </div>
    );
  }

  const vacia = platos.length === 0 && !carga;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-5 pb-16 md:px-8 md:pt-6">
      <PlatoPanel
        panel={panel}
        categorias={categorias}
        onClose={cerrarPanel}
        onNavegar={navegar}
        onGuardado={(p) => {
          setPanel(null);
          if (platos.some((x) => x.id === p.id)) reemplazar(p);
          cargar();
        }}
        onRetirar={(p) => { setPanel(null); cambiarActivo(p, false); }}
      />
      <CategoriasPanel
        open={panelCategorias}
        categorias={categorias}
        conteo={conteo}
        sinVincularPor={sinVincularPor}
        onClose={cerrarCategorias}
        onCambio={setCategorias}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Carta</h1>
          <p className="mt-0.5 text-[13px] text-[var(--pizarra)]">
            {enCarta.length === 0
              ? `Sin platos todavía · ${plural(categorias.length, 'categoría lista', 'categorías listas')}`
              : <>
                  {plural(enCarta.length, 'plato', 'platos')} en {plural(categorias.length, 'categoría', 'categorías')}
                  {agotados > 0 && <span className="font-medium text-[var(--aviso)]"> · {plural(agotados, 'agotado hoy', 'agotados hoy')}</span>}
                </>}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPanelCategorias(true)} className={botonCls}>Categorías</button>
          <button type="button" onClick={() => setPanel({ modo: 'nuevo', categoriaId: activa ?? undefined })} className={botonPrimarioCls}>
            <Plus className="size-4" aria-hidden /> Nuevo plato
          </button>
        </div>
      </header>

      {vacia ? (
        <CartaVacia categorias={categorias} onElegir={(id) => { setCarga({ categoriaId: id }); setTimeout(() => irA(id), 60); }} onCategorias={() => setPanelCategorias(true)} />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="relative w-full min-w-0 sm:max-w-[420px] sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--pizarra)]" aria-hidden />
              <input
                ref={buscador}
                type="search"
                aria-label="Buscar plato"
                placeholder="Buscar plato o descripción…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setBusqueda(''); }}
                className="h-9 w-full rounded-lg border border-[var(--linea)] bg-white pl-9 pr-9 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--pizarra)]/70 focus:border-[var(--tinta)] focus:ring-2 focus:ring-[var(--tinta)]/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {busqueda ? (
                <button type="button" aria-label="Borrar búsqueda" onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-[var(--pizarra)] hover:bg-[var(--muted)]">
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-b-2 border-[var(--linea)] bg-white px-1.5 font-sans text-[11px] font-semibold text-[var(--pizarra)] sm:block">/</kbd>
              )}
            </div>
            <div className="max-w-full overflow-x-auto">
              <Segmentado<FiltroCarta>
                etiqueta="Mostrar"
                value={filtro}
                onChange={setFiltro}
                opciones={[
                  { value: 'carta', label: `En carta ${enCarta.length}` },
                  { value: 'agotados', label: `Agotados hoy ${agotados}` },
                  { value: 'retirados', label: `Retirados ${retirados}` },
                ]}
              />
            </div>
          </div>

          {/* Índice en pastillas: tablet y teléfono */}
          <nav aria-label="Categorías" className="sticky top-0 z-20 -mx-4 mt-3 flex gap-1.5 overflow-x-auto bg-[var(--piedra)]/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none] lg:hidden">
            {secciones.map(({ cat }) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => irA(cat.id)}
                aria-current={activa === cat.id ? 'true' : undefined}
                className={[
                  'shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors',
                  activa === cat.id ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white text-[var(--ink)]',
                ].join(' ')}
              >
                {cat.nombre} <span className="tabular-nums opacity-70">{conteo[cat.id] ?? 0}</span>
              </button>
            ))}
          </nav>

          <div className="mt-3 grid gap-7 lg:mt-6 lg:grid-cols-[208px_minmax(0,1fr)]">
            <nav aria-label="Categorías" className="sticky top-6 hidden self-start lg:block">
              <h2 className="px-2.5 pb-2 text-[11px] font-semibold tracking-[0.07em] text-[var(--pizarra)] uppercase">Categorías</h2>
              <ul className="space-y-px text-[13.5px]">
                {categorias.map((c) => {
                  const n = conteo[c.id] ?? 0;
                  const on = activa === c.id;
                  const enVista = secciones.some((s) => s.cat.id === c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => irA(c.id)}
                        disabled={!enVista}
                        aria-current={on ? 'true' : undefined}
                        className={[
                          'flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-1.5 text-left transition-colors disabled:opacity-40',
                          on ? 'bg-white font-semibold text-[var(--ink)] shadow-[0_0_0_1px_var(--linea)]' : 'hover:bg-white/60',
                          n === 0 && !on ? 'text-[var(--pizarra)]' : 'text-[var(--ink)]',
                        ].join(' ')}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {sinVincularPor[c.id] ? <span className="size-[7px] shrink-0 rounded-full bg-[var(--aviso)]" title={`${sinVincularPor[c.id]} sin vincular a un insumo`} /> : null}
                          <span className="truncate">{c.nombre}</span>
                        </span>
                        <span className="text-[12.5px] font-normal tabular-nums text-[var(--pizarra)]">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => setPanelCategorias(true)} className="mt-2.5 px-2.5 text-[13px] font-medium text-[var(--tinta)] hover:underline">
                Ordenar y editar…
              </button>
            </nav>

            <div className="min-w-0">
              {secciones.every((s) => s.items.length === 0) && !mostrarVacias ? (
                <SinResultados
                  busqueda={busqueda.trim()}
                  filtro={filtro}
                  onCrear={() => setPanel({ modo: 'nuevo', nombre: busqueda.trim(), categoriaId: activa ?? undefined })}
                  onLimpiar={() => { setBusqueda(''); setFiltro('carta'); }}
                />
              ) : secciones.map(({ cat, items }) => {
                const abierta = carga?.categoriaId === cat.id;
                return (
                  <section key={cat.id} id={`cat-${cat.id}`} data-categoria={cat.id} className="mb-7 scroll-mt-16 lg:scroll-mt-6" aria-labelledby={`h-${cat.id}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h2 id={`h-${cat.id}`} className="text-[15px] font-semibold text-[var(--ink)]">{cat.nombre}</h2>
                      <span className="text-[13px] text-[var(--pizarra)] tabular-nums">{items.length === 0 ? 'Sin platos todavía' : plural(items.length, 'plato', 'platos')}</span>
                      <Etiqueta icono={<ChefHat className="size-3" strokeWidth={1.9} />}>{cat.esParaCocina ? 'Va a cocina' : 'No va a cocina'}</Etiqueta>
                      {cat.descuentaStock && <Etiqueta icono={<Package className="size-3" strokeWidth={1.9} />}>Descuenta stock</Etiqueta>}
                      {filtro !== 'retirados' && !abierta && (
                        <button type="button" onClick={() => setCarga({ categoriaId: cat.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-[var(--tinta)] hover:bg-[var(--tinta-tint)]">
                          <Plus className="size-3.5" aria-hidden /> Agregar platos
                        </button>
                      )}
                    </div>

                    <div className={['overflow-visible rounded-[10px] border bg-white', abierta ? 'border-[var(--tinta)]' : 'border-[var(--linea)]'].join(' ')}>
                      {items.length > 0 && (
                        <div className={`hidden gap-3 rounded-t-[10px] border-b border-[#EFEDE8] bg-[#FAF9F6] px-3.5 py-1.5 text-[11.5px] font-semibold text-[var(--pizarra)] md:grid ${columnasFila}`}>
                          <span>Plato</span><span className="text-right">Precio</span><span>{cat.descuentaStock ? 'Stock' : ''}</span><span>{filtro === 'retirados' ? '' : 'Disponible hoy'}</span><span />
                        </div>
                      )}
                      {items.map((p) => (
                        <FilaPlato
                          key={p.id}
                          plato={p}
                          categoria={cat}
                          categorias={categorias}
                          ocupado={ocupado === p.id}
                          onEditar={() => setPanel({ modo: 'editar', plato: p })}
                          onDuplicar={() => setPanel({ modo: 'nuevo', base: p, categoriaId: cat.id })}
                          onMover={(id) => moverA(p, id)}
                          onDisponible={(v) => cambiarDisponible(p, v)}
                          onActivo={(v) => cambiarActivo(p, v)}
                          onPrecio={(n) => cambiarPrecio(p, n)}
                        />
                      ))}
                      {abierta ? (
                        <CargaRapida
                          categoria={cat}
                          nombreInicial={carga?.nombre}
                          onCerrar={() => setCarga(null)}
                          onGuardado={() => { setCarga(null); cargar(); }}
                        />
                      ) : filtro !== 'retirados' && (
                        <button
                          type="button"
                          onClick={() => setCarga({ categoriaId: cat.id })}
                          className={[
                            'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--tinta)] transition-colors hover:bg-[var(--tinta-tint)]/60',
                            items.length ? 'rounded-b-[10px] border-t border-dashed border-[var(--linea)] bg-[#FDFCFA]' : 'rounded-[10px]',
                          ].join(' ')}
                        >
                          <Plus className="size-3.5" aria-hidden />
                          {items.length ? `Agregar platos a ${cat.nombre}` : `Cargar los primeros platos de ${cat.nombre}`}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Etiqueta({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--linea)] bg-[#FAF9F6] px-1.5 py-px text-xs text-[var(--pizarra)]">
      {icono}{children}
    </span>
  );
}

function SinResultados({ busqueda, filtro, onCrear, onLimpiar }: {
  busqueda: string; filtro: FiltroCarta; onCrear: () => void; onLimpiar: () => void;
}) {
  const texto = busqueda
    ? `Ningún plato se llama «${busqueda}»${filtro === 'agotados' ? ' entre los agotados' : filtro === 'retirados' ? ' entre los retirados' : ''}.`
    : filtro === 'agotados' ? 'No hay platos agotados hoy. Todo lo de la carta se puede pedir.'
    : 'No hay platos retirados de la carta.';
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--linea)] px-6 py-10 text-center">
      <p className="text-sm text-[var(--ink)]">{texto}</p>
      <div className="mt-3 flex justify-center gap-2">
        {busqueda && filtro !== 'retirados' && (
          <button type="button" onClick={onCrear} className={botonPrimarioCls}><Plus className="size-3.5" aria-hidden /> Crear «{busqueda}»</button>
        )}
        <button type="button" onClick={onLimpiar} className={botonCls}>Ver toda la carta</button>
      </div>
    </div>
  );
}

function CartaVacia({ categorias, onElegir, onCategorias }: {
  categorias: CategoriaCarta[];
  onElegir: (id: string) => void;
  onCategorias: () => void;
}) {
  return (
    <section className="mt-6 grid gap-8 rounded-[10px] border border-[var(--linea)] bg-white p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:p-8">
      <div>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Carga la carta por categorías</h2>
        <p className="mt-1.5 max-w-[52ch] text-sm text-[var(--pizarra)]">
          El mesero solo puede pedir lo que esté aquí. Elige una categoría y escribe nombre y precio de cada plato; también puedes pegar una lista entera.
        </p>
        <ol className="mt-5 space-y-2.5 text-[13.5px] text-[var(--ink)]">
          <Paso n={1}>Empieza por lo que más vendes. Lo demás se completa después.</Paso>
          <Paso n={2}>Para bebidas embotelladas, crea primero el insumo en <a href="/admin/stock" className="font-medium text-[var(--tinta)] underline underline-offset-2">Stock</a> y luego vincúlalo en cada plato.</Paso>
          <Paso n={3}>Revisa en <button type="button" onClick={onCategorias} className="font-medium text-[var(--tinta)] underline underline-offset-2">Categorías</button> cuáles van a cocina y en qué orden las ve el mesero.</Paso>
        </ol>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold text-[var(--pizarra)]">Elige por dónde empezar</h3>
        {categorias.length === 0 ? (
          <button type="button" onClick={onCategorias} className={botonPrimarioCls}><Plus className="size-3.5" aria-hidden /> Crear la primera categoría</button>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {categorias.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onElegir(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--linea)] px-3 py-2.5 text-left text-[13.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--tinta)] hover:bg-[var(--tinta-tint)]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
                >
                  <span className="min-w-0 truncate">{c.nombre}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[var(--tinta)]"><Plus className="size-3.5" aria-hidden />Agregar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
      <span className="grid size-[22px] place-items-center rounded-md bg-[var(--tinta-tint)] text-[11.5px] font-semibold text-[var(--tinta)]">{n}</span>
      <span>{children}</span>
    </li>
  );
}

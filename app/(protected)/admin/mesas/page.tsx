'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import type { Mesa, ModoZona, TipoMesa, Zona } from '@/lib/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PlanoEditor } from '@/components/admin/salon/PlanoEditor';
import { VistaNumeros } from '@/components/admin/salon/VistaNumeros';
import { AgregarMesasPanel } from '@/components/admin/salon/AgregarMesasPanel';
import { ZonasPanel } from '@/components/admin/salon/ZonasPanel';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { MesaFicha } from '@/components/admin/salon/MesaFicha';
import { AccionesLote } from '@/components/admin/salon/AccionesLote';
import { Segmentado, botonCls, botonPrimarioCls } from '@/components/admin/salon/controles';
import {
  BorradorPlano, Seleccion, borradorDesde, contarCambios, mismoBorrador,
} from '@/components/admin/salon/plano';

const CLAVE_ZONA = 'foxeats.admin.salon.zona';

export default function AdminSalonPage() {
  const [zonas, setZonas]   = useState<Zona[] | null>(null);
  const [mesas, setMesas]   = useState<Mesa[]>([]);
  const [error, setError]   = useState(false);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, BorradorPlano>>({});
  const [seleccion, setSeleccion]   = useState<Seleccion>(null);
  const [guardando, setGuardando]   = useState(false);
  const [panelAgregar, setPanelAgregar] = useState(false);
  const [panelZonas, setPanelZonas]     = useState(false);
  const [mesaEnPanel, setMesaEnPanel]   = useState<string | null>(null);
  const [mesaParaEliminar, setMesaParaEliminar] = useState<Mesa | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [idsParaEliminar, setIdsParaEliminar] = useState<string[]>([]);
  const [enLote, setEnLote] = useState(false);
  const [renombrando, setRenombrando] = useState<string | null>(null);

  const cargar = useCallback(async (seleccionarZona?: string) => {
    try {
      const [z, m] = await Promise.all([api.zonas.list(), api.mesas.list()]);
      setZonas(z);
      setMesas(m.filter((x) => x.numero !== 0)); // la 0 es la mesa virtual heredada de «para llevar»
      setError(false);
      setZonaActiva((prev) => {
        const pedida = seleccionarZona ?? prev ?? leerZonaGuardada();
        return pedida && z.some((x) => x.id === pedida) ? pedida : z[0]?.id ?? null;
      });
    } catch {
      setError(true);
      setZonas((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!zonaActiva) return;
    try { localStorage.setItem(CLAVE_ZONA, zonaActiva); } catch { /* sin almacenamiento */ }
  }, [zonaActiva]);

  // ── Derivados ─────────────────────────────────────────────
  const listaZonas = useMemo(() => zonas ?? [], [zonas]);
  const zonaDeMesa = useCallback(
    (m: Mesa) => (m.zonaId && listaZonas.some((z) => z.id === m.zonaId) ? m.zonaId : listaZonas[0]?.id ?? null),
    [listaZonas],
  );
  const mesasDe = useCallback((zonaId: string) => mesas.filter((m) => zonaDeMesa(m) === zonaId), [mesas, zonaDeMesa]);

  const base = useCallback((z: Zona) => borradorDesde(z, mesasDe(z.id)), [mesasDe]);

  /** Borrador en curso de la zona, alineado con las mesas que tiene hoy. */
  const borradorDe = useCallback((z: Zona): BorradorPlano => {
    const b = base(z);
    const d = borradores[z.id];
    if (!d) return b;
    const pos: BorradorPlano['pos'] = {};
    for (const id of Object.keys(b.pos)) pos[id] = d.pos[id] ?? b.pos[id];
    return { ...d, pos };
  }, [base, borradores]);

  const sucia = useCallback((z: Zona) => !!borradores[z.id] && !mismoBorrador(borradorDe(z), base(z)), [borradores, borradorDe, base]);
  const algunaSucia = listaZonas.some(sucia);

  useEffect(() => {
    if (!algunaSucia) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [algunaSucia]);

  const zona = listaZonas.find((z) => z.id === zonaActiva) ?? null;
  const mesasZona = zona ? mesasDe(zona.id) : [];
  const personasTotal = mesas.reduce((s, m) => s + (m.capacidad ?? 0), 0);

  // ── Acciones ──────────────────────────────────────────────
  function cambiarZona(id: string) {
    setZonaActiva(id);
    setSeleccion(null);
    setMulti([]);
  }

  async function renombrarZona(z: Zona, nombre: string) {
    setRenombrando(null);
    const limpio = nombre.trim();
    if (!limpio || limpio === z.nombre) return;
    setZonas((prev) => prev?.map((x) => (x.id === z.id ? { ...x, nombre: limpio } : x)) ?? prev);
    try {
      await api.zonas.actualizar(z.id, { nombre: limpio });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo renombrar la zona');
      cargar();
    }
  }

  async function moverVarias(ids: string[], zonaId: string) {
    const destino = listaZonas.find((z) => z.id === zonaId);
    setEnLote(true);
    const r = await Promise.allSettled(ids.map((id) => api.mesas.actualizar(id, { zonaId })));
    setEnLote(false);
    const ok = r.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(`${ok} mesa${ok !== 1 ? 's' : ''} movida${ok !== 1 ? 's' : ''} a ${destino?.nombre ?? 'otra zona'}`);
    if (ok < ids.length) toast.error(`${ids.length - ok} no se pudieron mover`);
    setMulti([]);
    cargar();
  }

  async function eliminarVarias() {
    const ids = idsParaEliminar.filter((id) => mesas.find((m) => m.id === id)?.estado !== 'ocupada');
    setEnLote(true);
    const r = await Promise.allSettled(ids.map((id) => api.admin.eliminarMesa(id)));
    setEnLote(false);
    const ok = r.filter((x) => x.status === 'fulfilled').length;
    if (ok) toast.success(`${ok} mesa${ok !== 1 ? 's' : ''} eliminada${ok !== 1 ? 's' : ''}`);
    if (ok < ids.length) toast.error(`${ids.length - ok} no se pudieron eliminar (pueden tener historial de visitas)`);
    setIdsParaEliminar([]);
    setMulti([]);
    cargar();
  }

  async function cambiarModo(modo: ModoZona) {
    if (!zona || zona.modo === modo) return;
    setSeleccion(null);
    setZonas((prev) => prev?.map((z) => (z.id === zona.id ? { ...z, modo } : z)) ?? prev);
    try {
      await api.zonas.actualizar(zona.id, { modo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el modo');
      cargar();
    }
  }

  async function guardarPlano() {
    if (!zona) return;
    const b = borradorDe(zona);
    setGuardando(true);
    try {
      await api.zonas.guardarPlano(zona.id, {
        filas: b.filas,
        columnas: b.columnas,
        referencias: b.referencias,
        mesas: Object.entries(b.pos).map(([id, p]) => ({ id, filaPosicion: p.fila, colPosicion: p.col, ancho: p.ancho })),
      });
      toast.success(`Plano de ${zona.nombre} guardado`);
      descartar(zona.id);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el plano');
    } finally {
      setGuardando(false);
    }
  }

  function descartar(zonaId: string) {
    setBorradores((prev) => {
      const next = { ...prev };
      delete next[zonaId];
      return next;
    });
    setSeleccion(null);
  }

  async function actualizarMesa(id: string, data: Partial<{ numero: number; capacidad: number; zonaId: string; tipo: TipoMesa }>) {
    try {
      const m = await api.mesas.actualizar(id, data);
      setMesas((prev) => prev.map((x) => (x.id === id ? m : x)));
      if (data.tipo === 'barra') {
        // Un taburete ocupa una celda: alinear borradores que la tuvieran ancha
        setBorradores((prev) => {
          const next = { ...prev };
          for (const [z, b] of Object.entries(prev)) {
            if (b.pos[id]?.ancho === 2) next[z] = { ...b, pos: { ...b.pos, [id]: { ...b.pos[id], ancho: 1 } } };
          }
          return next;
        });
      }
      if (data.zonaId) {
        const destino = listaZonas.find((z) => z.id === data.zonaId);
        toast.success(`Mesa ${m.numero} movida a ${destino?.nombre ?? 'otra zona'}`);
        setSeleccion(null);
        setMesaEnPanel(null);
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
      return false;
    }
  }

  async function confirmarEliminar() {
    if (!mesaParaEliminar) return;
    const m = mesaParaEliminar;
    try {
      await api.admin.eliminarMesa(m.id);
      toast.success(`Mesa ${m.numero} eliminada`);
      setMesaParaEliminar(null);
      setSeleccion(null);
      setMesaEnPanel(null);
      setMesas((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  // ── Render ────────────────────────────────────────────────
  if (zonas === null) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-5 md:px-8 md:py-6" aria-busy>
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[var(--muted)]" />
        <div className="h-80 w-full animate-pulse rounded-[10px] bg-[var(--muted)]" />
      </div>
    );
  }

  if (error && listaZonas.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-6">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Salón</h1>
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--aviso)]/30 bg-[var(--aviso-tint)] px-4 py-3 text-sm text-[#7a3c08]">
          No se pudieron cargar las zonas y mesas. Revisa que el servidor esté en marcha.
          <button type="button" onClick={() => cargar()} className={botonCls}><RotateCcw className="size-3.5" aria-hidden /> Reintentar</button>
        </div>
      </div>
    );
  }

  const borrador = zona ? borradorDe(zona) : null;
  const cambios = zona && borrador && sucia(zona) ? contarCambios(borrador, base(zona)) : 0;
  const mesaPanel = mesaEnPanel ? mesas.find((m) => m.id === mesaEnPanel) : undefined;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-49px)] max-w-[1440px] flex-col px-4 pt-5 md:px-8 md:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Salón</h1>
          <p className="mt-0.5 text-[13px] text-[var(--pizarra)] tabular-nums">
            {mesas.length} mesa{mesas.length !== 1 ? 's' : ''} en {listaZonas.length} zona{listaZonas.length !== 1 ? 's' : ''}
            {personasTotal > 0 && ` · ${personasTotal} personas sentadas como máximo`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPanelZonas(true)} className={botonCls}>
            <Layers className="size-3.5" aria-hidden /> Zonas
          </button>
          <button type="button" onClick={() => setPanelAgregar(true)} className={botonPrimarioCls} disabled={!zona}>
            <Plus className="size-3.5" aria-hidden /> Agregar mesas
          </button>
        </div>
      </div>

      {/* Zonas y modo */}
      <div className="mt-5 flex flex-col gap-3 border-b border-[var(--linea)] sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Zonas" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {listaZonas.map((z) => {
            const on = z.id === zonaActiva;
            const n = mesasDe(z.id).length;
            if (renombrando === z.id) {
              return (
                <div key={z.id} className="flex items-center border-b-2 border-[var(--tinta)] px-2 pt-1 pb-1.5">
                  <input
                    autoFocus
                    aria-label={`Nuevo nombre para ${z.nombre}`}
                    defaultValue={z.nombre}
                    maxLength={40}
                    size={Math.max(8, z.nombre.length + 2)}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => renombrarZona(z, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { e.currentTarget.value = z.nombre; e.currentTarget.blur(); }
                    }}
                    className="h-8 rounded-md border border-[var(--tinta)] bg-white px-2 text-sm font-medium text-[var(--ink)] outline-none ring-2 ring-[var(--tinta)]/15"
                  />
                </div>
              );
            }
            return (
              <button
                key={z.id}
                type="button"
                role="tab"
                aria-selected={on}
                title="Doble clic para renombrar"
                onClick={() => cambiarZona(z.id)}
                onDoubleClick={() => { cambiarZona(z.id); setRenombrando(z.id); }}
                onKeyDown={(e) => { if (e.key === 'F2') { e.preventDefault(); setRenombrando(z.id); } }}
                className={[
                  'flex items-center gap-2 border-b-2 px-3.5 pt-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150',
                  on ? 'border-[var(--tinta)] text-[var(--ink)]' : 'border-transparent text-[var(--pizarra)] hover:text-[var(--ink)]',
                ].join(' ')}
              >
                {z.nombre}
                <span className={[
                  'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  on ? 'bg-[var(--tinta)] text-white' : 'bg-[var(--muted)] text-[var(--pizarra)]',
                ].join(' ')}>{n}</span>
                {sucia(z) && <span className="size-1.5 rounded-full bg-[var(--aji)]" title="Cambios sin guardar" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPanelZonas(true)}
            className="flex items-center gap-1 border-b-2 border-transparent px-3 pt-2 pb-2.5 text-sm font-medium whitespace-nowrap text-[var(--tinta)] hover:text-[var(--tinta-hover)]"
          >
            <Plus className="size-3.5" aria-hidden /> Zona
          </button>
        </div>
        {zona && (
          <div className="pb-2">
            <Segmentado
              etiqueta={`Cómo se organiza ${zona.nombre}`}
              value={zona.modo}
              opciones={[{ value: 'plano', label: 'Plano' }, { value: 'numeros', label: 'Por número' }]}
              onChange={cambiarModo}
            />
          </div>
        )}
      </div>

      <div className="flex-1 py-5">
        {zona && borrador && (zona.modo === 'plano' ? (
          <PlanoEditor
            key={zona.id}
            zona={zona}
            zonas={listaZonas}
            mesas={mesasZona}
            borrador={borrador}
            onCambio={(b) => setBorradores((prev) => ({ ...prev, [zona.id]: b }))}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
            onActualizarMesa={actualizarMesa}
            onEliminarMesa={setMesaParaEliminar}
            onAgregar={() => setPanelAgregar(true)}
            multi={multi}
            onMulti={setMulti}
            onMoverVarias={moverVarias}
            onEliminarVarias={setIdsParaEliminar}
          />
        ) : (
          <VistaNumeros
            mesas={mesasZona}
            onElegir={(m) => setMesaEnPanel(m.id)}
            onAgregar={() => setPanelAgregar(true)}
            multi={multi}
            onAlternar={(m) => setMulti((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
          />
        ))}
      </div>

      {zona?.modo === 'numeros' && multi.length > 0 && (
        <AccionesLote
          compacto
          elegidas={mesas.filter((m) => multi.includes(m.id))}
          todas={mesas}
          zonas={listaZonas}
          zonaActual={zona.id}
          onMover={(z) => moverVarias(multi, z)}
          onEliminar={() => setIdsParaEliminar(multi)}
          onLimpiar={() => setMulti([])}
        />
      )}

      {zona?.modo === 'plano' && cambios > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--ink)] px-4 py-3 text-[13.5px] text-white md:-mx-8 md:px-8">
          <span>{cambios} cambio{cambios !== 1 ? 's' : ''} sin guardar en {zona.nombre}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => descartar(zona.id)}
              className="rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-medium hover:bg-white/10"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={guardarPlano}
              disabled={guardando}
              className="rounded-lg bg-[var(--aji)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink)] hover:brightness-95 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar plano'}
            </button>
          </div>
        </div>
      )}

      <AgregarMesasPanel
        open={panelAgregar}
        onClose={() => setPanelAgregar(false)}
        zonas={listaZonas}
        mesas={mesas}
        zonaInicial={zona?.id ?? listaZonas[0]?.id ?? ''}
        onCreadas={() => cargar()}
      />

      <ZonasPanel
        open={panelZonas}
        onClose={() => setPanelZonas(false)}
        zonas={listaZonas}
        mesas={mesas}
        onCambio={(id) => cargar(id)}
      />

      <SidePanel
        open={!!mesaPanel}
        titulo={mesaPanel ? `Mesa ${mesaPanel.numero}` : ''}
        onClose={() => setMesaEnPanel(null)}
      >
        {mesaPanel && (
          <MesaFicha
            mesa={mesaPanel}
            todas={mesas}
            zonas={listaZonas}
            onActualizar={(data) => actualizarMesa(mesaPanel.id, data)}
            onEliminar={() => setMesaParaEliminar(mesaPanel)}
          />
        )}
      </SidePanel>

      <ConfirmDialog
        open={idsParaEliminar.length > 0}
        title={(() => {
          const n = idsParaEliminar.filter((id) => mesas.find((m) => m.id === id)?.estado !== 'ocupada').length;
          return `Eliminar ${n} mesa${n !== 1 ? 's' : ''}`;
        })()}
        description={(() => {
          const elegidas = mesas.filter((m) => idsParaEliminar.includes(m.id));
          const libres = elegidas.filter((m) => m.estado !== 'ocupada').map((m) => m.numero).sort((a, b) => a - b);
          const ocupadas = elegidas.length - libres.length;
          return `Se eliminarán las mesas ${libres.join(', ')}. Esta acción no se puede deshacer.`
            + (ocupadas ? ` ${ocupadas} ocupada${ocupadas !== 1 ? 's' : ''} se mantiene${ocupadas !== 1 ? 'n' : ''}.` : '');
        })()}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={enLote}
        onConfirm={eliminarVarias}
        onCancel={() => setIdsParaEliminar([])}
      />

      <ConfirmDialog
        open={!!mesaParaEliminar}
        title={mesaParaEliminar ? `Eliminar mesa ${mesaParaEliminar.numero}` : ''}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmarEliminar}
        onCancel={() => setMesaParaEliminar(null)}
      />
    </div>
  );
}

function leerZonaGuardada() {
  try { return localStorage.getItem(CLAVE_ZONA); } catch { return null; }
}

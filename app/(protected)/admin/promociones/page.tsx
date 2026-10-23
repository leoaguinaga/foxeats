'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, ChevronRight, Plus, ReceiptText, Smartphone, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { CategoriaCarta, PlatoCarta, Promocion } from '@/lib/types';
import {
  DIAS, diaIsoHoy, estadoPromo, etiquetaDescuento, resumenDias, resumenHorario, type EstadoPromo,
} from '@/lib/promociones';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { botonCls, botonFantasmaCls, botonPrimarioCls } from '@/components/admin/salon/controles';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  BORRADOR_VACIO, PromoForm, borradorDesde, nombreSugerido, validarBorrador,
  type BorradorPromo, type ErroresPromo,
} from '@/components/admin/promociones/PromoForm';

const PLANTILLAS: Array<{ titulo: string; detalle: string; borrador: Partial<BorradorPromo> }> = [
  {
    titulo: 'Martes y jueves',
    detalle: '15 % en los platos que elijas',
    borrador: { tipoDescuento: 'porcentaje', valorDescuento: '15', diasSemana: [2, 4] },
  },
  {
    titulo: 'Almuerzo de semana',
    detalle: 'S/ 3 menos, lunes a viernes de 12:00 a 15:00',
    borrador: { tipoDescuento: 'monto_fijo', valorDescuento: '3', diasSemana: [1, 2, 3, 4, 5], horaInicio: '12:00', horaFin: '15:00' },
  },
  {
    titulo: 'Fin de semana',
    detalle: '10 % sábados y domingos, todo el día',
    borrador: { tipoDescuento: 'porcentaje', valorDescuento: '10', diasSemana: [6, 7] },
  },
];

const ESTILO_ESTADO: Record<EstadoPromo['tipo'], string> = {
  ahora: 'bg-[var(--aji-tint)] text-[var(--ink)]',
  hoy: 'bg-[var(--tinta-tint)] text-[var(--tinta)]',
  proxima: 'bg-[var(--muted)] text-[var(--pizarra)]',
  programada: 'bg-[var(--tinta-tint)] text-[var(--tinta)]',
  pausada: 'bg-[var(--muted)] text-[var(--pizarra)]',
  vencida: 'bg-[var(--muted)] text-[var(--pizarra)]',
  sin_platos: 'bg-[var(--aviso-tint)] text-[var(--aviso)]',
};

function EstadoPill({ estado }: { estado: EstadoPromo }) {
  return (
    <span className={['inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold', ESTILO_ESTADO[estado.tipo]].join(' ')}>
      {estado.tipo === 'ahora' && <span className="size-1.5 rounded-full bg-[var(--aji)] shadow-[0_0_0_3px_rgba(242,176,51,0.25)]" />}
      {estado.texto}
    </span>
  );
}

function Interruptor({ on, onChange, etiqueta }: { on: boolean; onChange: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={etiqueta}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={[
        'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
        on ? 'bg-[var(--tinta)]' : 'bg-[#C9CBD6]',
      ].join(' ')}
    >
      <span className={['absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(22,25,34,0.25)] transition-transform duration-150', on ? 'translate-x-[18px]' : 'translate-x-0.5'].join(' ')} />
    </button>
  );
}

// ─── Semana ───────────────────────────────────────────────────────────────────

function Semana({ promos, ahora, onAbrir }: { promos: Promocion[]; ahora: Date; onAbrir: (p: Promocion) => void }) {
  const hoy = diaIsoHoy(ahora);
  const vigentes = promos.filter((p) => !['pausada', 'vencida'].includes(estadoPromo(p, ahora).tipo));
  return (
    <section aria-labelledby="semana-titulo" className="rounded-[10px] border border-[var(--linea)] bg-white">
      <h2 id="semana-titulo" className="px-4 pt-3.5 text-[14px] font-semibold text-[var(--ink)]">La semana</h2>
      <div className="overflow-x-auto">
        <ol className="grid min-w-[620px] grid-cols-7 gap-px px-4 pb-4 pt-3">
          {DIAS.map((d) => {
            const delDia = vigentes
              .filter((p) => p.diasSemana.includes(d.iso))
              .sort((a, b) => (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''));
            const esHoy = d.iso === hoy;
            return (
              <li key={d.iso} className={['min-h-[92px] rounded-lg p-2', esHoy ? 'bg-[var(--piedra)]' : ''].join(' ')}>
                <p className="mb-2 flex items-baseline gap-1.5 text-[12px] font-semibold text-[var(--pizarra)]">
                  <span className={esHoy ? 'text-[var(--ink)]' : ''}>{d.corto}</span>
                  {esHoy && <span className="rounded-sm bg-[var(--aji)] px-1 text-[10.5px] font-bold text-[var(--ink)]">Hoy</span>}
                </p>
                {delDia.length === 0 ? (
                  <p className="text-[12px] text-[#9A9DAA]">Sin promos</p>
                ) : (
                  <ul className="space-y-1">
                    {delDia.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onAbrir(p)}
                          className="w-full rounded-md border border-[var(--linea)] bg-white px-2 py-1.5 text-left transition-colors hover:border-[var(--tinta)]/40"
                        >
                          <span className="line-clamp-2 text-[12px] font-medium leading-snug text-[var(--ink)]">{p.nombre}</span>
                          <span className="block text-[11.5px] text-[var(--pizarra)] tabular-nums">
                            {etiquetaDescuento(p)}{p.horaInicio || p.horaFin ? ` · ${resumenHorario(p)}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminPromocionesPage() {
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [platos, setPlatos] = useState<PlatoCarta[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => new Date());

  const [panel, setPanel] = useState<{ id: string | null; borrador: BorradorPromo } | null>(null);
  const [errores, setErrores] = useState<ErroresPromo>({});
  const [guardando, setGuardando] = useState(false);
  const [porEliminar, setPorEliminar] = useState<Promocion | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [p, m, c] = await Promise.all([api.admin.promociones.list(), api.menu.list(), api.categorias.list()]);
      setPromos(p);
      setPlatos(m);
      setCategorias(c);
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    cargar();
  }, [cargar]);
  // El estado («rige ahora», «hoy desde…») cambia con la hora: se recalcula cada minuto.
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const platoMap = useMemo(() => new Map(platos.map((p) => [p.id, p])), [platos]);
  const filas = useMemo(() => {
    const peso: Record<EstadoPromo['tipo'], number> = { ahora: 0, hoy: 1, sin_platos: 2, proxima: 3, programada: 4, pausada: 5, vencida: 6 };
    return promos
      .map((p) => ({ p, estado: estadoPromo(p, ahora) }))
      .sort((a, b) => peso[a.estado.tipo] - peso[b.estado.tipo]);
  }, [promos, ahora]);
  const rigiendo = filas.filter((f) => f.estado.tipo === 'ahora').length;

  function abrirNueva(base: Partial<BorradorPromo> = {}) {
    setErrores({});
    setPanel({ id: null, borrador: { ...BORRADOR_VACIO, ...base } });
  }
  function abrirEdicion(p: Promocion) {
    setErrores({});
    setPanel({ id: p.id, borrador: borradorDesde(p) });
  }
  const cerrarPanel = useCallback(() => setPanel(null), []);

  async function guardar() {
    if (!panel) return;
    const e = validarBorrador(panel.borrador);
    setErrores(e);
    if (Object.keys(e).length) return;
    const b = panel.borrador;
    const payload = {
      ...b,
      nombre: b.nombre.trim() || nombreSugerido(b),
      valorDescuento: parseFloat(b.valorDescuento).toFixed(2),
    };
    setGuardando(true);
    try {
      if (panel.id) {
        await api.admin.promociones.update(panel.id, payload);
        toast.success('Promoción guardada');
      } else {
        await api.admin.promociones.create(payload);
        toast.success('Promoción creada. El mesero ya ve el precio rebajado.');
      }
      setPanel(null);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(p: Promocion) {
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)));
    try {
      await api.admin.promociones.setActivo(p.id, !p.activo);
      toast.success(p.activo ? `«${p.nombre}» pausada` : `«${p.nombre}» activa`);
    } catch (err) {
      setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo: p.activo } : x)));
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar');
    }
  }

  async function eliminar() {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await api.admin.promociones.remove(porEliminar.id);
      setPromos((prev) => prev.filter((x) => x.id !== porEliminar.id));
      toast.success('Promoción eliminada');
      setPorEliminar(null);
      setPanel(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setEliminando(false);
    }
  }

  const contenedor = 'mx-auto max-w-[1120px] space-y-5 px-4 py-5 md:px-8 md:py-6';

  if (cargando) {
    return (
      <div className={contenedor} aria-busy>
        <div className="h-8 w-48 animate-pulse rounded-md bg-[var(--muted)]" />
        <div className="h-40 animate-pulse rounded-[10px] bg-white" />
        <div className="h-56 animate-pulse rounded-[10px] bg-white" />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className={contenedor}>
        <div className="rounded-[10px] border border-[var(--linea)] bg-white p-6">
          <p className="font-semibold text-[var(--ink)]">No se pudieron cargar las promociones</p>
          <p className="mt-1 text-sm text-[var(--pizarra)]">{errorCarga}</p>
          <button type="button" onClick={() => { setCargando(true); cargar(); }} className={[botonCls, 'mt-4'].join(' ')}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={contenedor}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Promociones</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--pizarra)]">
            {promos.length === 0
              ? 'Descuentos que se aplican solos según el día y la hora.'
              : rigiendo > 0
                ? `${rigiendo} ${rigiendo === 1 ? 'promoción rige' : 'promociones rigen'} en este momento.`
                : 'Ninguna promoción rige en este momento.'}
          </p>
        </div>
        {promos.length > 0 && (
          <button type="button" onClick={() => abrirNueva()} className={[botonPrimarioCls, 'h-9 px-3.5'].join(' ')}>
            <Plus className="size-4" strokeWidth={2.2} /> Nueva promoción
          </button>
        )}
      </header>

      {promos.length === 0 ? (
        <section className="rounded-[10px] border border-[var(--linea)] bg-white">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.1fr] md:p-8">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--ink)]">Configúrala una vez y se aplica sola</h2>
              <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-[var(--pizarra)]">
                Eliges los platos, cuánto se descuenta y qué días. Nadie tiene que acordarse de nada durante el turno.
              </p>
              <ul className="mt-5 space-y-3 text-[13.5px] text-[var(--ink)]">
                <li className="flex gap-3">
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--tinta)]" strokeWidth={1.9} />
                  El mesero ve el precio rebajado y la etiqueta de la promo al tomar el pedido.
                </li>
                <li className="flex gap-3">
                  <ReceiptText className="mt-0.5 size-4 shrink-0 text-[var(--tinta)]" strokeWidth={1.9} />
                  La caja cobra con el descuento ya aplicado y lo muestra en la cuenta.
                </li>
                <li className="flex gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-[var(--tinta)]" strokeWidth={1.9} />
                  Fuera del día u horario, el plato vuelve a su precio normal.
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-[var(--pizarra)]">Empieza con una idea frecuente</p>
              <ul className="space-y-2">
                {PLANTILLAS.map((t) => (
                  <li key={t.titulo}>
                    <button
                      type="button"
                      onClick={() => abrirNueva(t.borrador)}
                      className="group flex w-full items-center gap-3 rounded-[10px] border border-[var(--linea)] px-4 py-3 text-left transition-colors hover:border-[var(--tinta)]/40 hover:bg-[var(--tinta-tint)]/50"
                    >
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold text-[var(--ink)]">{t.titulo}</span>
                        <span className="block text-[13px] text-[var(--pizarra)]">{t.detalle}</span>
                      </span>
                      <ChevronRight className="size-4 text-[var(--pizarra)] transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => abrirNueva()} className={[botonPrimarioCls, 'mt-4 h-10 w-full'].join(' ')}>
                <Plus className="size-4" strokeWidth={2.2} /> Crear desde cero
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <Semana promos={promos} ahora={ahora} onAbrir={abrirEdicion} />

          <section aria-label="Todas las promociones" className="overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
            <ul className="divide-y divide-[var(--linea)]">
              {filas.map(({ p, estado }) => {
                const nombres = p.platoCartaIds.map((id) => platoMap.get(id)?.nombre).filter(Boolean) as string[];
                const apagada = estado.tipo === 'pausada' || estado.tipo === 'vencida';
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FAFAF8]">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(p)}
                      className="grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 text-left lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,200px)_auto] lg:gap-x-5"
                    >
                      <span className={['text-[17px] font-semibold tabular-nums', apagada ? 'text-[var(--pizarra)]' : 'text-[var(--ink)]'].join(' ')}>
                        {etiquetaDescuento(p)}
                      </span>
                      <span className="min-w-0">
                        <span className={['block truncate text-[14px] font-semibold', apagada ? 'text-[var(--pizarra)]' : 'text-[var(--ink)]'].join(' ')}>{p.nombre}</span>
                        <span className="block truncate text-[13px] text-[var(--pizarra)]">
                          {nombres.length === 0 ? 'Sin platos: no se aplica a nada' : nombres.length <= 3 ? nombres.join(', ') : `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más`}
                        </span>
                      </span>
                      <span className="col-start-2 text-[13px] text-[var(--ink)] lg:col-start-auto">
                        {resumenDias(p.diasSemana)}
                        <span className="text-[var(--pizarra)] lg:block"><span className="lg:hidden"> · </span>{resumenHorario(p)}</span>
                      </span>
                      <span className="col-start-2 lg:col-start-auto lg:w-[176px]"><EstadoPill estado={estado} /></span>
                    </button>
                    <Interruptor on={p.activo} onChange={() => alternarActivo(p)} etiqueta={p.activo ? `Pausar ${p.nombre}` : `Activar ${p.nombre}`} />
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <SidePanel
        open={panel !== null}
        ancho={560}
        titulo={panel?.id ? 'Editar promoción' : 'Nueva promoción'}
        descripcion="Se aplica sola al tomar el pedido; el mesero ve el precio final."
        onClose={cerrarPanel}
        pie={
          <>
            {panel?.id && (
              <button
                type="button"
                onClick={() => setPorEliminar(promos.find((x) => x.id === panel.id) ?? null)}
                className={[botonFantasmaCls, 'mr-auto text-[var(--alerta)] hover:bg-[var(--alerta-tint)] hover:text-[var(--alerta)]'].join(' ')}
              >
                <Trash2 className="size-4" strokeWidth={1.9} /> Eliminar
              </button>
            )}
            <button type="button" onClick={cerrarPanel} className={[botonCls, 'h-9'].join(' ')}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={[botonPrimarioCls, 'h-9 px-4'].join(' ')}>
              {guardando ? 'Guardando…' : panel?.id ? 'Guardar cambios' : 'Crear promoción'}
            </button>
          </>
        }
      >
        {panel && (
          <PromoForm
            key={panel.id ?? 'nueva'}
            borrador={panel.borrador}
            onChange={(b) => setPanel((prev) => (prev ? { ...prev, borrador: b } : prev))}
            errores={errores}
            platos={platos}
            categorias={categorias}
            otras={promos}
            editandoId={panel.id}
          />
        )}
      </SidePanel>

      <ConfirmDialog
        open={porEliminar !== null}
        title={`¿Eliminar «${porEliminar?.nombre ?? ''}»?`}
        description="Los pedidos ya cobrados conservan su descuento. Para detenerla un tiempo basta con pausarla."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={eliminando}
        onConfirm={eliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}

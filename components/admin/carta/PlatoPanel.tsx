'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type InsumoStock } from '@/lib/api';
import type { CategoriaCarta, PlatoCarta, RecetaPlato } from '@/lib/types';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { Campo, Stepper, botonCls, botonFantasmaCls, botonPrimarioCls, inputCls } from '@/components/admin/salon/controles';
import { Interruptor } from './Interruptor';
import { formatoPrecio, leerPrecio } from './carta';

export type PanelPlato =
  | { modo: 'editar'; plato: PlatoCarta }
  | { modo: 'nuevo'; categoriaId?: string; base?: PlatoCarta; nombre?: string };

type Form = {
  nombre: string;
  descripcion: string;
  precio: string;
  categoriaId: string;
  disponible: boolean;
  /** La comanda de cocina imprime la descripción bajo el nombre. */
  mostrarDescripcionEnCocina: boolean;
  /** Plato armable («Arma tu dúo»): se eligen `elegir` de las opciones al pedirlo. */
  armable: boolean;
  elegir: number;
  /** Una opción por línea. */
  opciones: string;
  insumoId: string;
  cantidad: number;
  /** Datos del insumo nuevo cuando insumoId es NUEVO_INSUMO. */
  stockInicial: string;
  unidad: string;
};

/** Valor especial del selector: crear el insumo con este mismo producto, sin pasar por Stock. */
const NUEVO_INSUMO = '__nuevo__';

type Props = {
  panel: PanelPlato | null;
  categorias: CategoriaCarta[];
  onClose: () => void;
  onGuardado: (p: PlatoCarta) => void;
  onRetirar: (p: PlatoCarta) => void;
  /** Ir al plato anterior (-1) o siguiente (1) de la lista visible. */
  onNavegar?: (dir: -1 | 1) => void;
};

/** Cada plato (o alta nueva) monta su propio formulario, así el estado nunca se arrastra de uno a otro. */
export function PlatoPanel(props: Props) {
  const { panel } = props;
  if (!panel) return null;
  const clave = panel.modo === 'editar' ? panel.plato.id : `nuevo-${panel.base?.id ?? ''}-${panel.categoriaId ?? ''}-${panel.nombre ?? ''}`;
  return <FormPlato key={clave} {...props} panel={panel} />;
}

function FormPlato({ panel, categorias, onClose, onGuardado, onRetirar, onNavegar }: Omit<Props, 'panel'> & {
  panel: PanelPlato;
}) {
  const editando = panel.modo === 'editar' ? panel.plato : null;
  const inicial = useMemo<Form>(() => {
    if (panel.modo === 'editar') {
      const p = panel.plato;
      return { nombre: p.nombre, descripcion: p.descripcion ?? '', precio: formatoPrecio(p.precio), categoriaId: p.categoriaId || p.categoria?.id, disponible: p.disponible, mostrarDescripcionEnCocina: p.mostrarDescripcionEnCocina, armable: !!p.combo, elegir: p.combo?.elegir ?? 2, opciones: p.combo?.opciones.join('\n') ?? '', insumoId: '', cantidad: 1, stockInicial: '0', unidad: 'unidad' };
    }
    const b = panel.base;
    return {
      nombre: b ? `${b.nombre} (copia)` : panel.nombre ?? '',
      descripcion: b?.descripcion ?? '',
      precio: b ? formatoPrecio(b.precio) : '',
      categoriaId: panel.categoriaId ?? b?.categoriaId ?? categorias[0]?.id ?? '',
      disponible: true,
      mostrarDescripcionEnCocina: b?.mostrarDescripcionEnCocina ?? false,
      armable: !!b?.combo,
      elegir: b?.combo?.elegir ?? 2,
      opciones: b?.combo?.opciones.join('\n') ?? '',
      insumoId: categorias.find((c) => c.id === (panel.categoriaId ?? b?.categoriaId ?? categorias[0]?.id))?.descuentaStock ? NUEVO_INSUMO : '',
      cantidad: 1,
      stockInicial: '0',
      unidad: 'unidad',
    };
  }, [panel, categorias]);

  const [form, setForm] = useState<Form>(inicial);
  const [receta, setReceta] = useState<RecetaPlato | null>(null);
  const [insumos, setInsumos] = useState<InsumoStock[] | null>(null);
  const [errorInsumos, setErrorInsumos] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Lee la receta del plato (o del original al duplicar): un solo insumo por plato.
  useEffect(() => {
    const origen = panel.modo === 'editar' ? panel.plato.id : panel.base?.id;
    if (!origen) return;
    let vivo = true;
    api.platos.recetas(origen).then((rs) => {
      if (!vivo) return;
      const r = rs[0] ?? null;
      if (panel.modo === 'editar') setReceta(r);
      if (r) setForm((f) => ({ ...f, insumoId: r.insumoId, cantidad: r.cantidadConsumida }));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [panel]);

  const categoria = categorias.find((c) => c.id === form.categoriaId);
  const usaStock = !!categoria?.descuentaStock;

  useEffect(() => {
    if (!usaStock || insumos !== null) return;
    api.insumos.list().then(setInsumos).catch(() => { setInsumos([]); setErrorInsumos(true); });
  }, [usaStock, insumos]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const precio = leerPrecio(form.precio);
  const errores = {
    nombre: !form.nombre.trim() ? 'Escribe el nombre del plato' : null,
    precio: precio === null ? 'Escribe un precio mayor a 0, por ejemplo 16.50' : null,
  };
  const listaOpciones = form.opciones.split('\n').map((o) => o.trim()).filter(Boolean);
  const errorOpciones = form.armable && listaOpciones.length < 1 ? 'Escribe al menos una opción, una por línea' : null;
  const insumo = insumos?.find((i) => i.id === form.insumoId);
  const sucio = JSON.stringify(form) !==
    JSON.stringify({ ...inicial, insumoId: receta?.insumoId ?? inicial.insumoId, cantidad: receta?.cantidadConsumida ?? 1 });

  async function guardar() {
    setIntentado(true);
    if (errores.nombre || errores.precio || errorOpciones || !form.categoriaId) return;
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        precio: precio!.toFixed(2),
        categoriaId: form.categoriaId,
        mostrarDescripcionEnCocina: form.mostrarDescripcionEnCocina,
        combo: form.armable ? { elegir: form.elegir, opciones: listaOpciones } : null,
      };
      let plato: PlatoCarta;
      if (editando) {
        const r = await api.admin.editarPlato(editando.id, datos);
        if (form.disponible !== editando.disponible) await api.menu.toggleDisponible(editando.id, form.disponible);
        plato = { ...editando, ...r, disponible: form.disponible };
      } else {
        const r = await api.admin.crearPlato({ ...datos, descripcion: datos.descripcion ?? undefined });
        if (!form.disponible) await api.menu.toggleDisponible(r.id, false);
        plato = { ...r, disponible: form.disponible };
      }

      // Receta: un solo insumo por plato. Cambiarla es borrar la anterior y crear la nueva.
      if (usaStock) {
        let insumoId = form.insumoId;
        if (insumoId === NUEVO_INSUMO) {
          const unidad = form.unidad.trim() || 'unidad';
          const nuevo = await api.insumos.create({
            nombre: datos.nombre,
            nombreUnidadMinima: unidad,
            nombreUnidadCompra: unidad,
            unidadesPorUnidadDeCompra: 1,
            stockActual: Math.max(0, parseInt(form.stockInicial, 10) || 0),
          });
          insumoId = nuevo.id;
        }
        const cambio = (receta?.insumoId ?? '') !== insumoId || (receta && receta.cantidadConsumida !== form.cantidad);
        if (cambio) {
          if (receta) await api.platos.borrarReceta(receta.id);
          if (insumoId) await api.platos.crearReceta(plato.id, { insumoId, cantidadConsumida: form.cantidad });
        }
      }

      toast.success(editando ? `«${datos.nombre}» guardado` : `«${datos.nombre}» agregado a ${categoria?.nombre ?? 'la carta'}`);
      onGuardado(plato);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el plato');
    } finally {
      setGuardando(false);
    }
  }

  const titulo = editando ? editando.nombre : panel.modo === 'nuevo' && panel.base ? 'Duplicar plato' : 'Nuevo plato';
  const descripcion = editando
    ? `${editando.categoria?.nombre ?? categoria?.nombre ?? ''}${editando.activo ? '' : ' · retirado de la carta'}`
    : 'Lo verá el mesero apenas lo guardes';

  return (
    <SidePanel
      open
      titulo={titulo}
      descripcion={descripcion}
      onClose={onClose}
      pie={
        <div className="flex w-full items-center justify-between gap-2">
          {editando && editando.activo ? (
            <button type="button" onClick={() => onRetirar(editando)} className={`${botonFantasmaCls} !text-[var(--alerta)] hover:!bg-[var(--alerta-tint)]`}>
              Retirar de la carta
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={botonCls}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={botonPrimarioCls}>
              {guardando ? 'Guardando…' : editando ? 'Guardar' : 'Agregar a la carta'}
            </button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); guardar(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); guardar(); }
        }}
      >
        {editando && onNavegar && (
          <div className="-mt-1 flex items-center justify-end gap-1 text-xs text-[var(--pizarra)]">
            <span className="mr-1">{sucio ? 'Guarda para pasar a otro plato' : 'Anterior o siguiente'}</span>
            {/* data-cerrar: SidePanel no les da el foco inicial; empieza en el nombre */}
            <button type="button" data-cerrar disabled={sucio} onClick={() => onNavegar(-1)} aria-label="Plato anterior" className="grid size-7 place-items-center rounded-md border border-[var(--linea)] hover:bg-[var(--muted)] disabled:opacity-40"><ChevronUp className="size-3.5" /></button>
            <button type="button" data-cerrar disabled={sucio} onClick={() => onNavegar(1)} aria-label="Plato siguiente" className="grid size-7 place-items-center rounded-md border border-[var(--linea)] hover:bg-[var(--muted)] disabled:opacity-40"><ChevronDown className="size-3.5" /></button>
          </div>
        )}

        <Campo label="Nombre" htmlFor="plato-nombre">
          <input
            id="plato-nombre"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Ej. Lomo saltado"
            aria-invalid={intentado && !!errores.nombre}
            className={`${inputCls} ${intentado && errores.nombre ? 'border-[var(--alerta)]' : ''}`}
          />
          {intentado && errores.nombre && <p className="text-xs text-[var(--alerta)]">{errores.nombre}</p>}
        </Campo>

        <Campo label="Descripción · la ve el mesero al tomar el pedido" htmlFor="plato-desc">
          <textarea
            id="plato-desc"
            rows={2}
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Ej. Con papas fritas y ensalada"
            className={`${inputCls} h-auto min-h-[64px] resize-y py-2 leading-snug`}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Precio" htmlFor="plato-precio">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--pizarra)]">S/</span>
              <input
                id="plato-precio"
                inputMode="decimal"
                value={form.precio}
                onChange={(e) => set('precio', e.target.value)}
                placeholder="0.00"
                aria-invalid={intentado && !!errores.precio}
                className={`${inputCls} pl-8 text-right font-semibold ${intentado && errores.precio ? 'border-[var(--alerta)]' : ''}`}
              />
            </div>
          </Campo>
          <Campo label="Categoría" htmlFor="plato-cat">
            <select id="plato-cat" value={form.categoriaId} onChange={(e) => set('categoriaId', e.target.value)} className={inputCls}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        {intentado && errores.precio && <p className="-mt-2 text-xs text-[var(--alerta)]">{errores.precio}</p>}

        {usaStock && (
          <section className="rounded-[9px] border border-[var(--linea)] bg-[#FDFCFA] p-3.5" aria-labelledby="plato-insumo-h">
            <h3 id="plato-insumo-h" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
              <Package className="size-3.5" strokeWidth={1.9} aria-hidden /> Descuenta del insumo
            </h3>
            <p className="mt-0.5 mb-2.5 text-[12.5px] text-[var(--pizarra)]">
              {categoria?.nombre} descuenta stock. Elige qué insumo baja con cada venta.
            </p>
            {insumos === null ? (
              <div className="h-9 animate-pulse rounded-lg bg-[var(--muted)]" />
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <select
                    aria-label="Insumo que descuenta"
                    value={form.insumoId}
                    onChange={(e) => set('insumoId', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Sin vincular</option>
                    <option value={NUEVO_INSUMO}>+ Crear insumo con este producto</option>
                    {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                  </select>
                  <Stepper
                    value={form.cantidad}
                    min={1}
                    max={99}
                    etiqueta={insumo?.nombreUnidadMinima ?? 'unidades'}
                    onChange={(n) => set('cantidad', n)}
                  />
                </div>
                {form.insumoId === NUEVO_INSUMO && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Campo label="Stock inicial" htmlFor="plato-stock-ini">
                      <input id="plato-stock-ini" inputMode="numeric" value={form.stockInicial} onChange={(e) => set('stockInicial', e.target.value.replace(/\D/g, ''))} className={inputCls} />
                    </Campo>
                    <Campo label="Se cuenta en" htmlFor="plato-unidad">
                      <input id="plato-unidad" value={form.unidad} onChange={(e) => set('unidad', e.target.value)} placeholder="botella, porción…" className={inputCls} />
                    </Campo>
                  </div>
                )}
                {errorInsumos && <p className="mt-2 text-[12.5px] text-[var(--aviso)]">No se pudieron leer los insumos existentes.</p>}
                <p className="mt-2 text-[12.5px] text-[var(--pizarra)]">
                  {form.insumoId === NUEVO_INSUMO ? (
                    <>Se crea el insumo «{form.nombre.trim() || 'este producto'}» en Stock al guardar. Después lo repones desde Stock.</>
                  ) : insumo ? (
                    <>Cada venta baja <b className="text-[var(--ink)]">{form.cantidad} {insumo.nombreUnidadMinima}</b> · en Stock hay <b className={insumo.stockActual <= 0 ? 'text-[var(--alerta)]' : 'text-[var(--ink)]'}>{insumo.stockActual}</b> · con 0 se marca agotado solo</>
                  ) : (
                    <span className="text-[var(--aviso)]">Sin vincular, este plato no descuenta stock.</span>
                  )}
                </p>
              </>
            )}
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--ink)]">
            Mostrar la descripción en la comanda
            <span className="block text-[12px] text-[var(--pizarra)]">Cocina la ve bajo el nombre; separa las partes con «+».</span>
          </span>
          <Interruptor activo={form.mostrarDescripcionEnCocina} etiqueta="Mostrar la descripción en la comanda" textoSi="Sí" textoNo="No" onChange={(v) => set('mostrarDescripcionEnCocina', v)} />
        </div>

        <section className="rounded-[9px] border border-[var(--linea)] bg-[#FDFCFA] p-3.5" aria-labelledby="plato-armable-h">
          <div className="flex items-center justify-between gap-3">
            <h3 id="plato-armable-h" className="text-[13px] font-semibold text-[var(--ink)]">
              Se arma al pedir
              <span className="block text-[12.5px] font-normal text-[var(--pizarra)]">Para dúos y combos: el mesero elige entre las opciones.</span>
            </h3>
            <Interruptor activo={form.armable} etiqueta="Se arma al pedir" textoSi="Sí" textoNo="No" onChange={(v) => set('armable', v)} />
          </div>
          {form.armable && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[var(--ink)]">Opciones a elegir</span>
                <div className="w-[112px]"><Stepper value={form.elegir} min={1} max={6} etiqueta="a elegir" onChange={(n) => set('elegir', n)} /></div>
              </div>
              <Campo label="Opciones · una por línea" htmlFor="plato-opciones">
                <textarea
                  id="plato-opciones"
                  rows={7}
                  value={form.opciones}
                  onChange={(e) => set('opciones', e.target.value)}
                  placeholder={'Ceviche clásico\nCeviche de la casa\nChaufa de mariscos'}
                  aria-invalid={intentado && !!errorOpciones}
                  className={`${inputCls} h-auto resize-y py-2 leading-snug ${intentado && errorOpciones ? 'border-[var(--alerta)]' : ''}`}
                />
                {intentado && errorOpciones && <p className="text-xs text-[var(--alerta)]">{errorOpciones}</p>}
              </Campo>
              <p className="text-[12.5px] text-[var(--pizarra)]">Cada dúo se pide por separado y su elección sale en la comanda.</p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between border-t border-[#EFEDE8] pt-3">
          <span className="text-[13px] text-[var(--ink)]">Disponible hoy</span>
          <Interruptor activo={form.disponible} etiqueta="Disponible hoy" onChange={(v) => set('disponible', v)} />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </SidePanel>
  );
}

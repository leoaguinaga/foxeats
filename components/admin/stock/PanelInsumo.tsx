'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Link2, Link2Off, Pencil, Scale, Trash2, Truck, X } from 'lucide-react';
import { api, type InsumoStock, type MovimientoStock } from '@/lib/api';
import type { PlatoCarta } from '@/lib/types';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { Stepper, botonCls, botonFantasmaCls, botonPrimarioCls, inputCls } from '@/components/admin/salon/controles';
import {
  MOTIVOS_DIFERENCIA, MOTIVOS_MERMA, TIPO_LABEL, cantidadAlterna, cantidadTexto, esFraccion, estadoStock, etaAgota, fechaCorta, plural,
} from './stock';

type Accion = { tipo: 'merma'; n: number; motivo: string | null } | { tipo: 'correccion'; n: number; motivo: string | null } | null;

export function PanelInsumo({ insumo, onClose, onCambio, onRecibir, onEditar }: {
  insumo: InsumoStock | null;
  onClose: () => void;
  onCambio: () => void;
  onRecibir: (id: string) => void;
  onEditar: (i: InsumoStock) => void;
}) {
  return (
    <SidePanel
      open={!!insumo}
      titulo={insumo?.nombre ?? ''}
      descripcion={insumo ? `${insumo.grupo} · llega en ${plural(insumo.nombreUnidadCompra, 2)} de ${insumo.unidadesPorUnidadDeCompra} ${plural(insumo.nombreUnidadMinima, insumo.unidadesPorUnidadDeCompra)}` : undefined}
      onClose={onClose}
      ancho={440}
    >
      {insumo && <Contenido key={insumo.id} i={insumo} onCambio={onCambio} onRecibir={onRecibir} onEditar={onEditar} />}
    </SidePanel>
  );
}

function Contenido({ i, onCambio, onRecibir, onEditar }: {
  i: InsumoStock; onCambio: () => void; onRecibir: (id: string) => void; onEditar: (i: InsumoStock) => void;
}) {
  const [accion, setAccion] = useState<Accion>(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [movs, setMovs] = useState<MovimientoStock[] | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const e = estadoStock(i);
  const eta = etaAgota(i);
  const u = i.unidadesPorUnidadDeCompra;

  useEffect(() => {
    let vivo = true;
    api.admin.movimientosStock(i.id).then((m) => { if (vivo) setMovs(m); }).catch(() => { if (vivo) setMovs([]); });
    return () => { vivo = false; };
  }, [i.id, i.stockActual]);

  async function guardar() {
    if (!accion?.motivo) return;
    setGuardando(true);
    try {
      if (accion.tipo === 'merma') {
        await api.admin.registrarMerma(i.id, { cantidad: accion.n, motivo: accion.motivo, nota: nota.trim() || undefined });
        toast.success(`Merma registrada: ${accion.n} ${plural(i.nombreUnidadMinima, accion.n)} de ${i.nombre}`);
      } else {
        await api.admin.corregirStock(i.id, { stockReal: accion.n, motivo: accion.motivo });
        toast.success(`${i.nombre} corregido a ${cantidadTexto(i, accion.n)}`);
      }
      setAccion(null); setNota('');
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarMinimo(delta: number) {
    const paso = esFraccion(i) ? u : 1;
    const nuevo = Math.max(0, i.minimo + delta * paso);
    try {
      await api.insumos.update(i.id, { minimo: nuevo });
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el aviso');
    }
  }

  async function desvincular(recetaId: string) {
    try {
      await api.platos.borrarReceta(recetaId);
      onCambio();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desvincular');
    }
  }

  const alterna = cantidadAlterna(i, i.stockActual);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
          {cantidadTexto(i, i.stockActual)}
          {esFraccion(i) && alterna && <small className="ml-1.5 text-[13px] font-medium tracking-normal text-[var(--pizarra)]">{alterna}</small>}
        </div>
        {e.k === 'neg' && <Aviso tono="alerta">Se vendieron {-i.stockActual} con el stock en cero. Corrige con un conteo.</Aviso>}
        {e.k === 'agot' && <Aviso tono="alerta">Agotado: los platos que dependen de este insumo no se pueden pedir.</Aviso>}
        {e.k === 'rep' && <Aviso tono="aviso">Por debajo del mínimo ({cantidadTexto(i, i.minimo)}){eta ? ` · ${eta}` : ''}.</Aviso>}
        {!i.platosAsociados.length && <Aviso tono="neutro">Ningún plato descuenta de este insumo. Vincula el que lo vende.</Aviso>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={botonCls} onClick={() => setAccion({ tipo: 'merma', n: 1, motivo: null })}><Trash2 className="size-4" />Merma</button>
        <button type="button" className={botonCls} onClick={() => setAccion({ tipo: 'correccion', n: Math.max(i.stockActual, 0), motivo: null })}><Scale className="size-4" />Corregir</button>
        <button type="button" className={botonCls} onClick={() => onRecibir(i.id)}><Truck className="size-4" />Recibir</button>
      </div>

      {accion && (
        <div className="space-y-3 rounded-[10px] border border-[var(--linea)] bg-[#FAF9F6] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <b className="text-sm text-[var(--ink)]">{accion.tipo === 'merma' ? 'Registrar merma' : 'Hay en realidad'}</b>
            <div className="w-32">
              <Stepper
                value={accion.n}
                min={accion.tipo === 'merma' ? 1 : 0}
                max={accion.tipo === 'merma' ? Math.max(i.stockActual, 1) : 9999}
                onChange={(n) => setAccion({ ...accion, n })}
                etiqueta={plural(i.nombreUnidadMinima, 2)}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--pizarra)]">
            {accion.tipo === 'merma'
              ? `${accion.n} ${plural(i.nombreUnidadMinima, accion.n)} · queda ${cantidadTexto(i, i.stockActual - accion.n)}`
              : `En ${plural(i.nombreUnidadMinima, 2)}. Diferencia con el sistema: ${accion.n - i.stockActual > 0 ? '+' : ''}${accion.n - i.stockActual}`}
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo">
            {(accion.tipo === 'merma' ? MOTIVOS_MERMA : MOTIVOS_DIFERENCIA).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={accion.motivo === m}
                onClick={() => setAccion({ ...accion, motivo: m })}
                className={['rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors', accion.motivo === m ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white hover:border-[#c9c6bd]'].join(' ')}
              >{m}</button>
            ))}
          </div>
          {accion.tipo === 'merma' && (
            <input value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Nota (opcional)" className={inputCls} aria-label="Nota" />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={botonFantasmaCls} onClick={() => setAccion(null)}>Cancelar</button>
            <button type="button" className={botonPrimarioCls} disabled={!accion.motivo || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : accion.motivo ? 'Guardar' : 'Elige un motivo'}
            </button>
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--pizarra)]">Se vende como</h3>
        {i.platosAsociados.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-t border-[var(--muted)] py-2 text-[13.5px] first:border-t-0">
            <span>
              {p.nombre}
              <span className="block text-xs text-[var(--pizarra)]">usa {p.cantidadConsumida} {plural(i.nombreUnidadMinima, p.cantidadConsumida)}</span>
            </span>
            <span className="flex items-center gap-2 text-[13px]">
              {p.quedan > 0
                ? <>alcanza para {p.quedan}</>
                : <span className="rounded-full bg-[var(--alerta-tint)] px-2 py-px text-[11.5px] font-semibold text-[var(--alerta)]">No alcanza</span>}
              <button type="button" onClick={() => desvincular(p.recetaId)} aria-label={`Desvincular ${p.nombre}`} className="rounded p-1 text-[var(--pizarra)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><X className="size-3.5" /></button>
            </span>
          </div>
        ))}
        {vinculando
          ? <Vincular insumo={i} onListo={() => { setVinculando(false); onCambio(); }} onCancelar={() => setVinculando(false)} />
          : <button type="button" className={`${botonFantasmaCls} -ml-2 mt-1`} onClick={() => setVinculando(true)}><Link2 className="size-4" />Vincular plato</button>}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--pizarra)]">Aviso</h3>
        <div className="flex items-center justify-between border-b border-[var(--muted)] py-2 text-[13.5px]">
          <span className="text-[var(--pizarra)]">Avisar por debajo de</span>
          <div className="flex items-center gap-2">
            <div className="w-28">
              <Stepper
                value={esFraccion(i) ? Math.round(i.minimo / u) : i.minimo}
                min={0}
                max={9999}
                onChange={(n) => cambiarMinimo(n - (esFraccion(i) ? Math.round(i.minimo / u) : i.minimo))}
                etiqueta="aviso"
              />
            </div>
            <span className="text-xs text-[var(--pizarra)]">{esFraccion(i) ? plural(i.nombreUnidadCompra, 2) : plural(i.nombreUnidadMinima, 2)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 text-[13.5px]">
          <span className="text-[var(--pizarra)]">Configuración</span>
          <button type="button" className={botonFantasmaCls} onClick={() => onEditar(i)}><Pencil className="size-3.5" />Editar insumo</button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-[var(--pizarra)]">Historial</h3>
        {movs === null ? <p className="text-sm text-[var(--pizarra)]">Cargando…</p>
          : movs.length === 0 ? <p className="text-sm text-[var(--pizarra)]">Sin movimientos todavía. Cada venta, compra, merma o conteo quedará aquí.</p>
          : movs.map((m) => (
            <div key={m.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-2.5 border-t border-[var(--muted)] py-2 text-[13px] first:border-t-0">
              <span className="pt-px text-xs text-[var(--pizarra)]">{fechaCorta(m.createdAt)}</span>
              <span className="min-w-0">
                <b className="font-semibold">{TIPO_LABEL[m.tipo]}</b>{m.usuario ? ` · ${m.usuario}` : ''}
                {(m.nota || m.motivo) && <span className="block truncate text-xs text-[var(--pizarra)]">{[m.motivo, m.nota].filter(Boolean).join(' · ')}</span>}
              </span>
              <span className={['text-right font-semibold', m.cantidad > 0 ? 'text-[var(--ok)]' : m.tipo === 'venta' ? '' : 'text-[var(--alerta)]'].join(' ')}>
                {m.cantidad > 0 ? '+' : '−'}{Math.abs(m.cantidad)}
                <span className="block text-xs font-medium text-[var(--pizarra)]">queda {m.saldo}</span>
              </span>
            </div>
          ))}
      </section>
    </div>
  );
}

function Aviso({ tono, children }: { tono: 'alerta' | 'aviso' | 'neutro'; children: React.ReactNode }) {
  const cls = tono === 'alerta' ? 'bg-[var(--alerta-tint)] text-[#7d231c]' : tono === 'aviso' ? 'bg-[var(--aviso-tint)] text-[#6d3507]' : 'bg-[var(--muted)] text-[#3a3e4a]';
  return (
    <div className={`mt-2.5 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] ${cls}`}>
      {tono === 'neutro' ? <Link2Off className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/** Vincula un plato de la carta que hoy no descuenta de ningún insumo. */
function Vincular({ insumo, onListo, onCancelar }: { insumo: InsumoStock; onListo: () => void; onCancelar: () => void }) {
  const [platos, setPlatos] = useState<PlatoCarta[] | null>(null);
  const [platoId, setPlatoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.menu.list().then((l) => setPlatos(l.filter((p) => p.activo && p.quedan === null))).catch(() => setPlatos([]));
  }, []);

  async function vincular() {
    if (!platoId) return;
    setGuardando(true);
    try {
      await api.platos.crearReceta(platoId, { insumoId: insumo.id, cantidadConsumida: cantidad });
      toast.success('Plato vinculado: ahora descuenta de este insumo');
      onListo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo vincular');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-[10px] border border-[var(--linea)] bg-[#FAF9F6] p-3.5">
      {platos === null ? <p className="text-sm text-[var(--pizarra)]">Cargando platos…</p>
        : platos.length === 0 ? <p className="text-sm text-[var(--pizarra)]">Todos los platos de la carta ya descuentan de algún insumo.</p>
        : (
          <>
            <select value={platoId} onChange={(ev) => setPlatoId(ev.target.value)} className={inputCls} aria-label="Plato a vincular">
              <option value="">Elige el plato…</option>
              {platos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[var(--pizarra)]">Cada venta usa</span>
              <div className="w-32"><Stepper value={cantidad} min={1} max={999} onChange={setCantidad} etiqueta={plural(insumo.nombreUnidadMinima, 2)} /></div>
            </div>
            <p className="text-xs text-[var(--pizarra)]">{cantidad} {plural(insumo.nombreUnidadMinima, cantidad)} por plato. Un plato descuenta de un solo insumo: si ya tenía otro, se reemplaza.</p>
          </>
        )}
      <div className="flex justify-end gap-2">
        <button type="button" className={botonFantasmaCls} onClick={onCancelar}>Cancelar</button>
        <button type="button" className={botonPrimarioCls} disabled={!platoId || guardando} onClick={vincular}>Vincular</button>
      </div>
    </div>
  );
}

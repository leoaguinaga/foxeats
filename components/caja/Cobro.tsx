'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, Minus, Plus, Printer, X } from 'lucide-react';
import { api, type DetalleVisitaCaja, type MetodoPago, type VisitaResumen } from '@/lib/api';
import type { PlatoCarta } from '@/lib/types';
import { CancelarRondaDialog } from '@/components/mesero/CancelarRondaDialog';
import { hora, soles } from '@/components/admin/caja/fechas';
import { Catalogo } from './Catalogo';

const METODOS: Array<{ key: MetodoPago; label: string }> = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'yape_plin', label: 'Yape / Plin' },
  { key: 'transferencia', label: 'Transf.' },
];

// La primera línea es «automática»: absorbe lo que falta hasta que la cajera escribe su monto.
type Linea = { id: number; metodo: MetodoPago; monto: string; auto?: boolean };
type Adicion = { plato: PlatoCarta; cantidad: number };

const num = (v: string | undefined | null) => parseFloat(v || '0') || 0;
const limpiar = (v: string) => {
  const s = v.replace(',', '.').replace(/[^\d.-]/g, '');
  const [ent, ...resto] = s.split('.');
  return resto.length ? `${ent}.${resto.join('').slice(0, 2)}` : ent;
};

export function Cobro({ visita, detalle, productos, onCobrado, onCerrar, onRefreshDetalle }: {
  visita: VisitaResumen;
  detalle: DetalleVisitaCaja | null;
  productos: PlatoCarta[];
  onCobrado: () => void;
  onCerrar: () => void;
  onRefreshDetalle: () => Promise<void>;
}) {
  const [modo, setModo] = useState<'cuenta' | 'agregar'>('cuenta');
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ id: 0, metodo: 'efectivo', monto: '', auto: true }]);
  const [recibido, setRecibido] = useState('');
  const [quitando, setQuitando] = useState<number | null>(null);
  const [adicion, setAdicion] = useState<Adicion[]>([]);
  const [anulando, setAnulando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siguienteId = useRef(1);

  const totalCuenta = num(detalle?.total ?? visita.total);
  const ajuste = num(ajusteMonto);
  const hayAjuste = Math.abs(ajuste) > 0.005;
  const totalACobrar = Math.max(0, totalCuenta + (hayAjuste ? ajuste : 0));

  const fijas = lineas.slice(1).reduce((s, l) => s + num(l.monto), 0);
  const montoDe = (l: Linea, i: number) => (i === 0 && l.auto ? Math.max(0, totalACobrar - fijas) : num(l.monto));
  const pagado = lineas.reduce((s, l, i) => s + montoDe(l, i), 0);
  const pendiente = Math.round((totalACobrar - pagado) * 100) / 100;
  const cuadra = Math.abs(pendiente) < 0.01;
  const ajusteValido = !hayAjuste || ajusteMotivo.trim().length > 0;
  const efectivo = lineas.reduce((s, l, i) => s + (l.metodo === 'efectivo' ? montoDe(l, i) : 0), 0);
  const vuelto = num(recibido) - efectivo;
  const listo = !!detalle && cuadra && ajusteValido && totalACobrar > 0;
  const titulo = visita.tipo === 'mesa' ? `Mesa ${visita.mesaNumero}` : visita.nombreCliente || 'Cliente';

  function cambiarLinea(id: number, cambio: Partial<Linea>) {
    setError(null);
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambio } : l)));
  }

  function dividir() {
    const usados = new Set(lineas.map((l) => l.metodo));
    const metodo = METODOS.find((m) => !usados.has(m.key))?.key ?? 'tarjeta';
    setLineas((prev) => [...prev, { id: siguienteId.current++, metodo, monto: '' }]);
  }

  async function cobrar() {
    if (!detalle) return;
    if (!ajusteValido) { setError('Escribe el motivo del descuento o recargo.'); return; }
    if (!cuadra) { setError(pendiente > 0 ? `Faltan S/ ${soles(pendiente)} por asignar.` : `Los pagos superan el total por S/ ${soles(-pendiente)}.`); return; }
    setOcupado(true);
    setError(null);
    try {
      const pagos = lineas
        .map((l, i) => ({ metodoPago: l.metodo, monto: Math.round(montoDe(l, i) * 100) / 100 }))
        .filter((p) => p.monto > 0);
      await api.caja.registrarPago(visita.visitaId, pagos, hayAjuste ? { monto: ajuste, motivo: ajusteMotivo.trim() } : undefined);
      toast.success(`${titulo} cobrado · S/ ${soles(totalACobrar)}`);
      onCobrado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  async function quitarItem(itemIds: string[]) {
    setOcupado(true);
    try {
      for (const id of itemIds) await api.pedidos.cancelarItem(id);
      setQuitando(null);
      await onRefreshDetalle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo quitar el producto');
    } finally {
      setOcupado(false);
    }
  }

  async function imprimir() {
    setImprimiendo(true);
    try {
      await api.caja.imprimirPrecuenta(visita.visitaId);
      toast.success('Precuenta enviada a la impresora');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir la precuenta');
    } finally {
      setImprimiendo(false);
    }
  }

  async function anular(motivo: string) {
    setOcupado(true);
    try {
      await api.caja.cancelarVisita(visita.visitaId, motivo);
      toast.success('Pedido anulado');
      setAnulando(false);
      onCobrado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo anular el pedido');
    } finally {
      setOcupado(false);
    }
  }

  const agregar = (plato: PlatoCarta) => setAdicion((prev) =>
    prev.some((a) => a.plato.id === plato.id)
      ? prev.map((a) => (a.plato.id === plato.id ? { ...a, cantidad: a.cantidad + 1 } : a))
      : [...prev, { plato, cantidad: 1 }]);
  const cambiarAdicion = (id: string, diff: number) => setAdicion((prev) =>
    prev.flatMap((a) => (a.plato.id !== id ? [a] : a.cantidad + diff > 0 ? [{ ...a, cantidad: a.cantidad + diff }] : [])));
  const totalAdicion = adicion.reduce((s, a) => s + num(a.plato.precio) * a.cantidad, 0);

  async function enviarAdicion() {
    if (!adicion.length) return;
    setOcupado(true);
    try {
      const paraLlevar = visita.tipo === 'llevar' || visita.tipo === 'delivery';
      await api.visitas.crearPedido(
        visita.visitaId,
        adicion.map((a) => ({ platoCartaId: a.plato.id, cantidad: a.cantidad })),
        paraLlevar ? { paraLlevar: true, nombreClienteLlevar: visita.nombreCliente || 'Cliente' } : {},
      );
      toast.success('Productos enviados a cocina');
      setAdicion([]);
      setModo('cuenta');
      await onRefreshDetalle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron agregar los productos');
    } finally {
      setOcupado(false);
    }
  }

  // Esc retrocede un paso; ⌘/Ctrl + Enter cobra.
  const cobrarRef = useRef(cobrar);
  useEffect(() => { cobrarRef.current = cobrar; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anulando) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (quitando !== null) setQuitando(null);
        else if (modo === 'agregar') { setAdicion([]); setModo('cuenta'); }
        else onCerrar();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && modo === 'cuenta') { e.preventDefault(); cobrarRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anulando, quitando, modo, onCerrar]);

  const tipoTexto = visita.tipo === 'llevar' ? 'Para llevar' : visita.tipo === 'delivery' ? 'Delivery' : null;
  const subtitulo = [tipoTexto, `desde las ${hora(visita.fechaApertura)}`, `${visita.pedidos} ${visita.pedidos === 1 ? 'ronda' : 'rondas'}`].filter(Boolean).join(' · ');
  const descuentoPromo = num(detalle?.descuentoTotal);
  const envio = visita.tipo === 'delivery' ? num(visita.costoEnvio) : 0;

  const boton = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--linea)] bg-white px-3 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--piedra)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 sm:p-4" role="dialog" aria-modal="true" aria-label={`Cobrar ${titulo}`}>
      <div className="grid h-dvh w-full grid-cols-[minmax(0,1fr)] overflow-y-auto bg-white shadow-[0_30px_60px_-20px_rgba(22,25,34,0.45)] sm:h-[min(640px,calc(100dvh-32px))] sm:max-w-[980px] sm:rounded-[12px] lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">

        {/* ── Izquierda: la cuenta o el catálogo para agregar ── */}
        <section className="flex min-h-0 flex-col">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--linea)] px-5 py-4 sm:px-6">
            {modo === 'cuenta' ? (
              <div className="min-w-0">
                <h2 className="text-[20px] sm:truncate font-semibold tracking-[-0.01em] text-[var(--ink)]">{titulo}</h2>
                <p className="text-[13px] text-[var(--pizarra)]">{subtitulo}</p>
                {visita.tipo === 'delivery' && (visita.direccionDelivery || visita.telefonoCliente) && (
                  <p className="mt-0.5 truncate text-[13px] text-[var(--ink)]">{[visita.direccionDelivery, visita.telefonoCliente].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => { setAdicion([]); setModo('cuenta'); }} className="inline-flex items-center gap-2 py-1 text-[14px] font-semibold text-[var(--tinta)]">
                <ArrowLeft className="size-4" strokeWidth={1.9} aria-hidden /> Volver a la cuenta de {titulo}
              </button>
            )}
            {modo === 'cuenta' && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setModo('agregar')} disabled={!detalle} className={boton}>
                  <Plus className="size-4" strokeWidth={1.9} aria-hidden /> Agregar
                </button>
                <button type="button" onClick={imprimir} disabled={imprimiendo} className={boton}>
                  <Printer className="size-4" strokeWidth={1.9} aria-hidden /> {imprimiendo ? 'Imprimiendo…' : 'Precuenta'}
                </button>
              </div>
            )}
          </header>

          {modo === 'agregar' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <Catalogo
                productos={productos}
                cantidades={new Map(adicion.map((a) => [a.plato.id, a.cantidad]))}
                onAgregar={agregar}
                rejilla="grid-cols-2 sm:grid-cols-3"
              />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6">
                {!detalle ? (
                  <div className="space-y-3 py-5" aria-label="Cargando la cuenta">
                    {[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-[#ECEBE6]" style={{ width: `${80 - i * 15}%` }} />)}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--linea)]">
                    {detalle.resumen.map((item, i) => {
                      const desc = num(item.descuentoUnitario) * item.cantidad;
                      return (
                        <li key={i} className="py-2.5">
                          {quitando === i ? (
                            <div className="flex items-center justify-between gap-3 text-[14px]">
                              <span className="text-[var(--ink)]">¿Quitar {item.cantidad > 1 ? `los ${item.cantidad}` : ''} {item.nombre} de la cuenta?</span>
                              <span className="flex shrink-0 gap-2">
                                <button type="button" onClick={() => setQuitando(null)} className="h-8 rounded-md px-2.5 text-[13px] font-semibold text-[var(--pizarra)] hover:bg-[var(--piedra)]">No</button>
                                <button type="button" onClick={() => quitarItem(item.itemIds)} disabled={ocupado} className="h-8 rounded-md bg-[var(--alerta)] px-3 text-[13px] font-semibold text-white hover:bg-[var(--alerta-hover)] disabled:opacity-50">Quitar</button>
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto_28px] items-center gap-2 text-[14px]">
                              <span className="font-semibold text-[var(--pizarra)] tabular-nums">{item.cantidad}×</span>
                              <span className="min-w-0">
                                <span className="text-[var(--ink)]">{item.nombre}</span>
                                {desc > 0 && <span className="block text-[12.5px] text-[var(--ok)]">Promoción −S/ {soles(desc)}</span>}
                              </span>
                              <span className="font-semibold text-[var(--ink)] tabular-nums">{soles(num(item.precioUnitario) * item.cantidad)}</span>
                              <button type="button" onClick={() => setQuitando(i)} aria-label={`Quitar ${item.nombre}`} className="grid size-7 place-items-center rounded-md text-[#9A9DA8] hover:bg-[var(--alerta-tint)] hover:text-[var(--alerta)]">
                                <X className="size-4" strokeWidth={1.9} />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5 border-t border-[var(--linea)] px-6 py-3.5 text-[14px]">
                {(descuentoPromo > 0 || envio > 0 || hayAjuste) && (
                  <div className="flex justify-between text-[var(--pizarra)]"><span>Consumo</span><span className="tabular-nums">{soles(totalCuenta - envio + descuentoPromo)}</span></div>
                )}
                {descuentoPromo > 0 && <div className="flex justify-between text-[var(--ok)]"><span>Promociones</span><span className="tabular-nums">−{soles(descuentoPromo)}</span></div>}
                {envio > 0 && <div className="flex justify-between text-[var(--pizarra)]"><span>Envío</span><span className="tabular-nums">{soles(envio)}</span></div>}

                {ajusteAbierto || hayAjuste ? (
                  <div className="flex items-center gap-2 py-1">
                    <input
                      value={ajusteMonto}
                      onChange={(e) => { setAjusteMonto(limpiar(e.target.value)); setError(null); }}
                      inputMode="decimal"
                      placeholder="−5.00"
                      aria-label="Monto del descuento (negativo) o recargo"
                      className="h-9 w-24 rounded-md border border-[var(--linea)] px-2 text-right text-[14px] tabular-nums outline-none focus:border-[var(--tinta)]"
                    />
                    <input
                      value={ajusteMotivo}
                      onChange={(e) => { setAjusteMotivo(e.target.value); setError(null); }}
                      placeholder="Motivo (obligatorio)"
                      aria-label="Motivo del ajuste"
                      className={`h-9 min-w-0 flex-1 rounded-md border px-2.5 text-[14px] outline-none focus:border-[var(--tinta)] ${hayAjuste && !ajusteMotivo.trim() ? 'border-[var(--alerta)]' : 'border-[var(--linea)]'}`}
                    />
                    <button type="button" onClick={() => { setAjusteMonto(''); setAjusteMotivo(''); setAjusteAbierto(false); }} aria-label="Quitar ajuste" className="grid size-8 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[var(--piedra)]">
                      <X className="size-4" strokeWidth={1.9} />
                    </button>
                  </div>
                ) : null}

                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-semibold text-[var(--ink)]">Total de la cuenta</span>
                  <span className="text-[18px] font-semibold text-[var(--ink)] tabular-nums">S/ {soles(totalACobrar)}</span>
                </div>
                <div className="flex justify-between pt-0.5 text-[13px]">
                  {!ajusteAbierto && !hayAjuste
                    ? <button type="button" onClick={() => setAjusteAbierto(true)} className="font-medium text-[var(--tinta)] hover:underline">Descuento o recargo</button>
                    : <span />}
                  <button type="button" onClick={() => setAnulando(true)} disabled={ocupado} className="font-medium text-[var(--alerta)] hover:underline">Anular pedido</button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Derecha: el pago, o lo que se va a agregar ── */}
        <section className="flex min-h-0 flex-col border-t border-[var(--linea)] bg-[#FBFAF7] lg:border-t-0 lg:border-l">
          <header className="flex items-center justify-between px-5 pt-4">
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">{modo === 'cuenta' ? 'Cobrar' : 'Agregar a la cuenta'}</h3>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-8 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[#ECEBE6] hover:text-[var(--ink)]">
              <X className="size-4" strokeWidth={1.9} />
            </button>
          </header>

          {modo === 'agregar' ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5">
                {adicion.length === 0 ? (
                  <p className="py-10 text-center text-[14px] text-[var(--pizarra)]">Toca un producto para agregarlo. Se enviará a cocina como una ronda nueva.</p>
                ) : (
                  <ul className="divide-y divide-[var(--linea)]">
                    {adicion.map((a) => (
                      <li key={a.plato.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold text-[var(--ink)]">{a.plato.nombre}</span>
                          <span className="text-[13px] text-[var(--pizarra)] tabular-nums">S/ {soles(num(a.plato.precio) * a.cantidad)}</span>
                        </span>
                        <span className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--linea)] bg-white">
                          <button type="button" onClick={() => cambiarAdicion(a.plato.id, -1)} aria-label={`Uno menos de ${a.plato.nombre}`} className="grid h-9 w-10 place-items-center text-[var(--pizarra)]">
                            {a.cantidad === 1 ? <X className="size-4" strokeWidth={1.9} /> : <Minus className="size-4" strokeWidth={1.9} />}
                          </button>
                          <span className="w-8 text-center text-[14px] font-semibold tabular-nums">{a.cantidad}</span>
                          <button type="button" onClick={() => cambiarAdicion(a.plato.id, 1)} aria-label={`Uno más de ${a.plato.nombre}`} className="grid h-9 w-10 place-items-center text-[var(--pizarra)]">
                            <Plus className="size-4" strokeWidth={1.9} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-[var(--linea)] px-5 py-4">
                <button
                  type="button"
                  onClick={enviarAdicion}
                  disabled={ocupado || !adicion.length}
                  className="h-12 w-full rounded-lg bg-[var(--tinta)] text-[15px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-50"
                >
                  {ocupado ? 'Enviando…' : `Enviar a cocina · S/ ${soles(totalAdicion)}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-2 pb-4">
                <p className="text-[34px] font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums">
                  <span className="mr-1.5 text-[18px] font-medium text-[var(--pizarra)]">S/</span>{soles(totalACobrar)}
                </p>

                <div className="space-y-3">
                  {lineas.map((l, i) => (
                    <div key={l.id} className="space-y-2 rounded-[10px] border border-[var(--linea)] bg-white p-2.5">
                      <div role="radiogroup" aria-label={`Medio de pago ${i + 1}`} className="grid grid-cols-4 gap-1">
                        {METODOS.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            role="radio"
                            aria-checked={l.metodo === m.key}
                            onClick={() => cambiarLinea(l.id, { metodo: m.key })}
                            className={[
                              'h-9 rounded-md text-[12.5px] font-semibold transition-colors',
                              l.metodo === m.key ? 'bg-[var(--tinta)] text-white' : 'text-[var(--pizarra)] hover:bg-[var(--piedra)] hover:text-[var(--ink)]',
                            ].join(' ')}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {lineas.length > 1 && (
                        <div className="flex items-center gap-2">
                          <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[var(--linea)] px-3 focus-within:border-[var(--tinta)]">
                            <span className="text-[13px] text-[var(--pizarra)]">S/</span>
                            <input
                              value={i === 0 && l.auto ? montoDe(l, 0).toFixed(2) : l.monto}
                              onChange={(e) => cambiarLinea(l.id, { monto: limpiar(e.target.value), auto: false })}
                              onFocus={(e) => e.target.select()}
                              inputMode="decimal"
                              placeholder="0.00"
                              aria-label={`Monto en ${METODOS.find((m) => m.key === l.metodo)?.label}`}
                              className="min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold tabular-nums outline-none"
                            />
                          </label>
                          <button type="button" onClick={() => setLineas((prev) => prev.filter((x) => x.id !== l.id).map((x, k) => (k === 0 ? { ...x, auto: true } : x)))} aria-label="Quitar este medio de pago" className="grid size-9 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[var(--piedra)]">
                            <X className="size-4" strokeWidth={1.9} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {lineas.length < 4 && (
                    <button type="button" onClick={dividir} className="text-[13px] font-semibold text-[var(--tinta)] hover:underline">+ Dividir el pago</button>
                  )}
                </div>

                {efectivo > 0 && (
                  <div className="space-y-2">
                    <p className="text-[13px] text-[var(--pizarra)]">El cliente paga con</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[efectivo, ...[20, 50, 100, 200].filter((b) => b > efectivo).slice(0, 3)].map((b, k) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setRecibido(b.toFixed(2))}
                          className={['h-8 rounded-md border px-2.5 text-[13px] font-semibold whitespace-nowrap tabular-nums', num(recibido) === b ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:bg-[var(--piedra)]'].join(' ')}
                        >
                          {k === 0 ? 'Justo' : `S/ ${b}`}
                        </button>
                      ))}
                      <input
                        value={recibido && ![efectivo, 20, 50, 100, 200].includes(num(recibido)) ? recibido : ''}
                        onChange={(e) => setRecibido(limpiar(e.target.value))}
                        inputMode="decimal"
                        placeholder="Otro"
                        aria-label="Efectivo recibido"
                        className="h-8 w-16 rounded-md border border-[var(--linea)] bg-white px-2 text-[13px] tabular-nums outline-none focus:border-[var(--tinta)]"
                      />
                    </div>
                    {num(recibido) > 0 && (
                      <p className={['text-[14px] font-semibold', vuelto >= 0 ? 'text-[var(--ink)]' : 'text-[var(--alerta)]'].join(' ')}>
                        {vuelto >= 0 ? <>Vuelto <span className="tabular-nums">S/ {soles(vuelto)}</span></> : <>Faltan <span className="tabular-nums">S/ {soles(-vuelto)}</span> en efectivo</>}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 border-t border-[var(--linea)] px-5 py-4">
                {lineas.length > 1 && (
                  <p className={['flex items-center gap-1.5 text-[13.5px] font-semibold', cuadra ? 'text-[var(--ok)]' : pendiente > 0 ? 'text-[var(--alerta)]' : 'text-[var(--aviso)]'].join(' ')}>
                    {cuadra ? <><Check className="size-4" strokeWidth={2} aria-hidden /> Los pagos cuadran</> : pendiente > 0 ? `Faltan S/ ${soles(pendiente)}` : `Sobran S/ ${soles(-pendiente)}`}
                  </p>
                )}
                {!ajusteValido && !error && <p className="text-[13px] text-[var(--alerta)]">Escribe el motivo del descuento o recargo para cobrar.</p>}
                {error && <p role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error}</p>}
                <button
                  type="button"
                  onClick={cobrar}
                  disabled={ocupado || !listo}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tinta)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
                >
                  {ocupado ? 'Registrando…' : <>Cobrar <span className="tabular-nums">S/ {soles(totalACobrar)}</span></>}
                  <kbd className="hidden rounded border border-white/30 bg-white/10 px-1.5 text-[11px] font-semibold lg:inline">⌘↵</kbd>
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <CancelarRondaDialog open={anulando} loading={ocupado} onConfirm={anular} onCancel={() => setAnulando(false)} />
    </div>
  );
}


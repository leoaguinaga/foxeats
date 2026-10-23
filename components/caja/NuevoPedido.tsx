'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus, X } from 'lucide-react';
import { api, type VisitaResumen } from '@/lib/api';
import type { PlatoCarta } from '@/lib/types';
import { Catalogo, campoCaja as campo } from './Catalogo';
import { soles } from '@/components/admin/caja/fechas';

type Tipo = 'llevar' | 'delivery';
type Linea = { plato: PlatoCarta; cantidad: number; notas: string };

const ENVIOS = ['3.00', '5.00', '8.00'];

/**
 * Pedido de mostrador (para llevar o delivery): catálogo a la izquierda y ticket a la derecha.
 * Vive montado aunque la cajera vuelva a «Por cobrar», así un pedido a medias no se pierde.
 */
export function NuevoPedido({ activo, productos, porCobrar, onVolver, onCreado }: {
  activo: boolean;
  productos: PlatoCarta[];
  porCobrar: number;
  onVolver: () => void;
  /** Se llama tras guardar; con `cobrar` trae la cuenta para abrir el cobro. */
  onCreado: (cobrar: VisitaResumen | null) => void;
}) {
  const [tipo, setTipo] = useState<Tipo>('llevar');

  const [lineas, setLineas] = useState<Record<Tipo, Linea[]>>({ llevar: [], delivery: [] });
  const [nombre, setNombre] = useState<Record<Tipo, string>>({ llevar: '', delivery: '' });
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [envio, setEnvio] = useState('5.00');
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLElement>(null);

  const actuales = lineas[tipo];
  const cantidades = new Map(actuales.map((l) => [l.plato.id, l.cantidad]));
  const subtotal = actuales.reduce((s, l) => s + parseFloat(l.plato.precio) * l.cantidad, 0);
  const costoEnvio = parseFloat(envio || '0') || 0;
  const total = subtotal + (tipo === 'delivery' && actuales.length ? costoEnvio : 0);
  const unidades = actuales.reduce((s, l) => s + l.cantidad, 0);
  const otro: Tipo = tipo === 'llevar' ? 'delivery' : 'llevar';
  const unidadesOtro = lineas[otro].reduce((s, l) => s + l.cantidad, 0);

  function editar(fn: (ls: Linea[]) => Linea[]) {
    setError(null);
    setLineas((prev) => ({ ...prev, [tipo]: fn(prev[tipo]) }));
  }

  const agregar = (plato: PlatoCarta) =>
    editar((ls) => ls.some((l) => l.plato.id === plato.id)
      ? ls.map((l) => (l.plato.id === plato.id ? { ...l, cantidad: l.cantidad + 1 } : l))
      : [...ls, { plato, cantidad: 1, notas: '' }]);

  const cambiar = (id: string, diff: number) =>
    editar((ls) => ls.flatMap((l) => {
      if (l.plato.id !== id) return [l];
      const cantidad = l.cantidad + diff;
      return cantidad > 0 ? [{ ...l, cantidad }] : [];
    }));

  const anotar = (id: string, notas: string) =>
    editar((ls) => ls.map((l) => (l.plato.id === id ? { ...l, notas } : l)));

  function limpiar() {
    setLineas((prev) => ({ ...prev, [tipo]: [] }));
    setNombre((prev) => ({ ...prev, [tipo]: '' }));
    if (tipo === 'delivery') { setTelefono(''); setDireccion(''); setEnvio('5.00'); }
    setNotaAbierta(null);
  }

  async function guardar(cobrar: boolean) {
    const cliente = nombre[tipo].trim();
    if (!actuales.length) { setError('Agrega al menos un producto.'); return; }
    if (!cliente && tipo === 'delivery') { setError('Escribe el nombre de quien recibe.'); return; }
    if (tipo === 'delivery' && !direccion.trim()) { setError('Falta la dirección de entrega.'); return; }
    if (tipo === 'delivery' && costoEnvio < 0) { setError('El envío no puede ser negativo.'); return; }

    const items = actuales.map((l) => ({ platoCartaId: l.plato.id, cantidad: l.cantidad, notas: l.notas.trim() || undefined }));
    setGuardando(true);
    setError(null);
    try {
      const res = tipo === 'llevar'
        ? await api.caja.crearPedidoLlevar({ nombreCliente: cliente || undefined, items })
        : await api.caja.crearPedidoDelivery({
          nombreCliente: cliente,
          telefonoCliente: telefono.trim() || undefined,
          direccionDelivery: direccion.trim(),
          costoEnvio,
          items,
        });

      // Sin nombre, el backend lo llama «Cliente N».
      const nombreFinal: string = ('nombreCliente' in res && typeof res.nombreCliente === 'string' && res.nombreCliente) || cliente;
      const cuenta: VisitaResumen | null = cobrar && res.visitaId ? {
        visitaId: res.visitaId,
        mesaNumero: null,
        tipo,
        nombreCliente: nombreFinal,
        telefonoCliente: tipo === 'delivery' ? telefono.trim() || null : null,
        direccionDelivery: tipo === 'delivery' ? direccion.trim() : null,
        costoEnvio: tipo === 'delivery' ? costoEnvio.toFixed(2) : null,
        paraLlevar: true,
        fechaApertura: new Date().toISOString(),
        total: total.toFixed(2),
        pedidos: 1,
      } : null;

      if (!cobrar) toast.success(`Pedido de ${nombreFinal} enviado a cocina`);
      limpiar();
      onCreado(cuenta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el pedido. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  // «/» busca en el catálogo mientras la vista está abierta.
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) { e.preventDefault(); buscarRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activo]);

  return (
    <div hidden={!activo} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--linea)] px-4 py-2.5 md:px-6">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-2 rounded-md py-1 text-[14px] font-semibold text-[var(--tinta)] hover:text-[var(--tinta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.9} aria-hidden />
          Por cobrar
          {porCobrar > 0 && <span className="rounded-full bg-[var(--tinta)] px-2 text-[12px] text-white tabular-nums">{porCobrar}</span>}
        </button>
        <div role="radiogroup" aria-label="Tipo de pedido" className="inline-flex rounded-lg bg-[#ECEBE6] p-0.5 text-[13.5px]">
          {([['llevar', 'Para llevar'], ['delivery', 'Delivery']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={tipo === k}
              onClick={() => { setTipo(k); setError(null); setNotaAbierta(null); }}
              className={[
                'inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
                tipo === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {l}
              {k === otro && unidadesOtro > 0 && (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--aji)] px-1 text-[11px] font-bold text-[var(--ink)] tabular-nums" aria-label={`${unidadesOtro} productos en espera`}>
                  {unidadesOtro}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Catálogo */}
        <section aria-label="Catálogo" className="min-h-0 px-4 py-4 md:px-6 lg:overflow-y-auto">
          <Catalogo productos={productos} cantidades={cantidades} onAgregar={agregar} buscarRef={buscarRef} />
        </section>

        {/* Ticket */}
        <section ref={ticketRef} aria-label="Pedido" className="flex min-h-0 flex-col border-t border-[var(--linea)] bg-white lg:border-t-0 lg:border-l">
          <div className="space-y-2.5 border-b border-[var(--linea)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">{tipo === 'llevar' ? 'Pedido para llevar' : 'Pedido delivery'}</h2>
            {tipo === 'delivery' && (
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="off" placeholder="Teléfono (opcional)" aria-label="Teléfono" className={campo} />
            )}
            <input
              value={nombre[tipo]}
              onChange={(e) => { setNombre((prev) => ({ ...prev, [tipo]: e.target.value })); setError(null); }}
              autoComplete="off"
              placeholder={tipo === 'llevar' ? 'Nombre (opcional; si no, «Cliente N»)' : 'Nombre de quien recibe'}
              aria-label="Nombre del cliente"
              className={campo}
            />
            {tipo === 'delivery' && (
              <>
                <input value={direccion} onChange={(e) => { setDireccion(e.target.value); setError(null); }} autoComplete="off" placeholder="Dirección de entrega" aria-label="Dirección de entrega" className={campo} />
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Costo de envío">
                  <span className="mr-1 text-[13px] text-[var(--pizarra)]">Envío</span>
                  {ENVIOS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      role="radio"
                      aria-checked={envio === e}
                      onClick={() => setEnvio(e)}
                      className={[
                        'h-8 rounded-md border px-2.5 text-[13px] font-semibold tabular-nums transition-colors',
                        envio === e ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] text-[var(--ink)] hover:bg-[var(--piedra)]',
                      ].join(' ')}
                    >
                      S/ {parseFloat(e)}
                    </button>
                  ))}
                  <input
                    value={ENVIOS.includes(envio) ? '' : envio}
                    onChange={(e) => setEnvio(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    placeholder="Otro"
                    aria-label="Otro costo de envío"
                    className="h-8 w-16 rounded-md border border-[var(--linea)] px-2 text-[13px] tabular-nums outline-none focus:border-[var(--tinta)]"
                  />
                </div>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {actuales.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[var(--pizarra)]">Toca un producto para agregarlo.</p>
            ) : (
              <ul className="divide-y divide-[var(--linea)]">
                {actuales.map((l) => (
                  <li key={l.plato.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5">
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{l.plato.nombre}</span>
                    <span className="text-right text-[14px] font-semibold text-[var(--ink)] tabular-nums">{soles(parseFloat(l.plato.precio) * l.cantidad)}</span>
                    {notaAbierta === l.plato.id ? (
                      <input
                        autoFocus
                        value={l.notas}
                        onChange={(e) => anotar(l.plato.id, e.target.value)}
                        onBlur={() => setNotaAbierta(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setNotaAbierta(null); }}
                        placeholder="Sin cebolla, bien dorado…"
                        aria-label={`Nota para ${l.plato.nombre}`}
                        className="h-8 min-w-0 rounded-md border border-[var(--linea)] px-2 text-[13px] outline-none focus:border-[var(--tinta)]"
                      />
                    ) : (
                      <button type="button" onClick={() => setNotaAbierta(l.plato.id)} className="justify-self-start truncate text-left text-[13px] font-medium text-[var(--tinta)] hover:underline">
                        {l.notas ? <span className="text-[var(--pizarra)]">{l.notas}</span> : '+ Nota'}
                      </button>
                    )}
                    <span className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--linea)]">
                      <button type="button" onClick={() => cambiar(l.plato.id, -1)} aria-label={l.cantidad === 1 ? `Quitar ${l.plato.nombre}` : `Uno menos de ${l.plato.nombre}`} className="grid h-9 w-10 place-items-center bg-[#FBFAF7] text-[var(--pizarra)] hover:text-[var(--ink)]">
                        {l.cantidad === 1 ? <X className="size-4" strokeWidth={1.9} /> : <Minus className="size-4" strokeWidth={1.9} />}
                      </button>
                      <span className="w-9 text-center text-[14px] font-semibold tabular-nums">{l.cantidad}</span>
                      <button type="button" onClick={() => cambiar(l.plato.id, 1)} aria-label={`Uno más de ${l.plato.nombre}`} className="grid h-9 w-10 place-items-center bg-[#FBFAF7] text-[var(--pizarra)] hover:text-[var(--ink)]">
                        <Plus className="size-4" strokeWidth={1.9} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2.5 border-t border-[var(--linea)] bg-[#FBFAF7] px-5 py-3.5">
            {tipo === 'delivery' && actuales.length > 0 && (
              <div className="flex justify-between text-[13.5px] text-[var(--pizarra)]">
                <span>Productos S/ {soles(subtotal)} · envío S/ {soles(costoEnvio)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold text-[var(--ink)]">Total{unidades > 0 && <span className="ml-1.5 font-normal text-[var(--pizarra)]">· {unidades} {unidades === 1 ? 'producto' : 'productos'}</span>}</span>
              <span className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums">
                <span className="mr-1 text-[15px] font-medium text-[var(--pizarra)]">S/</span>{soles(total)}
              </span>
            </div>
            {error && <p role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error}</p>}
            <div className="grid grid-cols-[1fr_1.25fr] gap-2">
              <button
                type="button"
                onClick={() => guardar(false)}
                disabled={guardando || !actuales.length}
                className="h-11 rounded-lg border border-[var(--linea)] bg-white text-[14px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--piedra)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                Enviar a cocina
              </button>
              <button
                type="button"
                onClick={() => guardar(true)}
                disabled={guardando || !actuales.length}
                className="h-11 rounded-lg bg-[var(--tinta)] text-[14px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
              >
                {guardando ? 'Guardando…' : 'Cobrar ahora'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* En pantallas angostas el ticket queda abajo: esta barra lo trae a la vista. */}
      {unidades > 0 && (
        <button
          type="button"
          onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="sticky bottom-3 mx-4 mb-3 flex items-center justify-between rounded-[10px] bg-[var(--tinta)] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(22,25,34,0.5)] lg:hidden"
        >
          <span className="font-medium text-white/75">{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
          <span className="tabular-nums">Ver pedido · S/ {soles(total)}</span>
        </button>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PlatoCarta, PromocionVigente, Visita } from '@/lib/types';
import { etiquetaDescuento, precioConPromo } from '@/lib/promociones';
import { Tag } from 'lucide-react';
import { RondaCard } from '@/components/mesero/RondaCard';
import { CantidadControl } from '@/components/mesero/CantidadControl';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CancelarRondaDialog } from '@/components/mesero/CancelarRondaDialog';

interface LineaPedido {
  platoCartaId: string;
  cantidad: number;
  notas: string;
  notaAbierta: boolean;
}

export default function MesaPage() {
  const { visitaId } = useParams<{ visitaId: string }>();
  const router = useRouter();

  const [visita, setVisita] = useState<Visita | null>(null);
  const [menu, setMenu] = useState<PlatoCarta[]>([]);
  const [lineas, setLineas] = useState<Map<string, LineaPedido>>(new Map());
  const [enviando, setEnviando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [cartaAbierta, setCartaAbierta] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [modalCobro, setModalCobro] = useState(false);
  const [cobrandoPagos, setCobrandoPagos] = useState<Array<{ metodo: 'efectivo' | 'tarjeta' | 'yape_plin' | 'transferencia'; monto: string }>>([{ metodo: 'efectivo', monto: '' }]);
  const [cobrando, setCobrando] = useState(false);
  const [pedidoPorCancelar, setPedidoPorCancelar] = useState<string | null>(null);
  const [itemPorCancelar, setItemPorCancelar] = useState<string | null>(null);
  const [confirmarLiberar, setConfirmarLiberar] = useState(false);
  const [rondaParaLlevar, setRondaParaLlevar] = useState(false);
  const [nombreClienteLlevar, setNombreClienteLlevar] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const cartaRef = useRef<HTMLDivElement>(null);

  const cleanString = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const matchesSearch = useCallback((platoName: string) => {
    if (!searchQuery) return true;
    const nameClean = cleanString(platoName);
    const queryWords = cleanString(searchQuery).split(/\s+/).filter(Boolean);
    return queryWords.every(word => nameClean.includes(word));
  }, [searchQuery]);

  const platoMap = useMemo(() => new Map(menu.map((p) => [p.id, p])), [menu]);

  // Promos que rigen ahora: el mesero ve el precio que se cobrará. Si dos cubren
  // el mismo plato gana la primera, igual que en el backend.
  const [promos, setPromos] = useState<PromocionVigente[]>([]);
  const promoPorPlato = useMemo(() => {
    const m = new Map<string, PromocionVigente>();
    for (const pr of promos) for (const id of pr.platoCartaIds) if (!m.has(id)) m.set(id, pr);
    return m;
  }, [promos]);
  const precioFinal = useCallback(
    (plato: PlatoCarta | undefined) => precioConPromo(parseFloat(plato?.precio ?? '0'), plato ? promoPorPlato.get(plato.id) : null),
    [promoPorPlato],
  );

  useEffect(() => {
    const cargarPromos = () => api.promociones.vigentes().then(setPromos).catch(() => { });
    cargarPromos();
    const id = setInterval(cargarPromos, 60_000);
    return () => clearInterval(id);
  }, []);

  const [categoriasLista, setCategoriasLista] = useState<import('@/lib/types').CategoriaCarta[]>([]);

  const fetchVisita = useCallback(async () => {
    try {
      const data = await api.visitas.get(visitaId);
      setVisita(data);
    } catch {
      // silencioso en polling
    }
  }, [visitaId]);

  useEffect(() => {
    const cargarMenu = () => api.menu.list().then(setMenu).catch(() => { });
    cargarMenu();
    // El «quedan N» cambia con cada venta de otras mesas.
    const menuInterval = setInterval(cargarMenu, 10000);
    api.categorias.list().then(setCategoriasLista).catch(() => { });
    fetchVisita();
    const interval = setInterval(fetchVisita, 5000);
    return () => { clearInterval(interval); clearInterval(menuInterval); };
  }, [fetchVisita]);

  function setLinea(platoId: string, update: Partial<LineaPedido>) {
    setLineas((prev) => {
      const next = new Map(prev);
      const actual = next.get(platoId) ?? {
        platoCartaId: platoId,
        cantidad: 0,
        notas: '',
        notaAbierta: false,
      };
      next.set(platoId, { ...actual, ...update });
      return next;
    });
  }

  const itemsParaEnviar = Array.from(lineas.values()).filter((l) => l.cantidad > 0);

  // Cuántas unidades más se pueden pedir de un plato: lo que queda del insumo,
  // descontando lo que ya llevan en este pedido los otros platos que usan el mismo.
  function maximoPedible(plato: PlatoCarta): number {
    if (plato.insumoId === null || plato.stockActual === null || !plato.cantidadConsumida) return 20;
    let otros = 0;
    for (const l of lineas.values()) {
      if (l.platoCartaId === plato.id || l.cantidad <= 0) continue;
      const otro = platoMap.get(l.platoCartaId);
      if (otro?.insumoId === plato.insumoId) otros += l.cantidad * (otro.cantidadConsumida ?? 0);
    }
    return Math.max(0, Math.min(20, Math.floor((plato.stockActual - otros) / plato.cantidadConsumida)));
  }
  const totalPedido = itemsParaEnviar.reduce((s, l) => {
    return s + precioFinal(platoMap.get(l.platoCartaId)) * l.cantidad;
  }, 0);

  // Validación para envío: si la ronda es para llevar, exige nombre del cliente.
  const nombreClienteLimpio = nombreClienteLlevar.trim();
  const puedeEnviar =
    itemsParaEnviar.length > 0 && !enviando && (!rondaParaLlevar || nombreClienteLimpio.length > 0);

  async function handleEnviarPedido() {
    if (itemsParaEnviar.length === 0) return;
    if (rondaParaLlevar && !nombreClienteLimpio) {
      toast.error('Ingresa el nombre del cliente para llevar');
      return;
    }
    setEnviando(true);
    try {
      await api.visitas.crearPedido(
        visitaId,
        itemsParaEnviar.map((l) => ({
          platoCartaId: l.platoCartaId,
          cantidad: l.cantidad,
          notas: l.notas || undefined,
        })),
        rondaParaLlevar
          ? { paraLlevar: true, nombreClienteLlevar: nombreClienteLimpio }
          : {},
      );
      toast.success(rondaParaLlevar ? 'Pedido para llevar enviado' : 'Pedido enviado a cocina');
      setLineas(new Map());
      setRondaParaLlevar(false);
      setNombreClienteLlevar('');
      fetchVisita();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar pedido');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCancelarRonda(motivo: string) {
    if (!pedidoPorCancelar) return;
    const pedidoId = pedidoPorCancelar;
    setMarcando(pedidoId);
    try {
      await api.pedidos.cambiarEstado(pedidoId, 'cancelado', { motivoCancelacion: motivo });
      toast.success('Ronda cancelada');
      setPedidoPorCancelar(null);
      fetchVisita();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setMarcando(null);
    }
  }

  function iniciarCancelarItem(itemId: string) {
    setItemPorCancelar(itemId);
  }

  async function confirmarCancelarItem() {
    if (!itemPorCancelar) return;
    const itemId = itemPorCancelar;
    setMarcando(itemId);
    try {
      await api.pedidos.cancelarItem(itemId);
      toast.success('Producto cancelado');
      setItemPorCancelar(null);
      fetchVisita();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar producto');
    } finally {
      setMarcando(null);
    }
  }

  async function ejecutarLiberarMesa() {
    if (!visita) return;
    setCancelando(true);
    try {
      await api.visitas.cerrar(visita.id);
      toast.success(visita.paraLlevar ? 'Pedido cerrado' : 'Mesa liberada');
      router.push('/mesero');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al liberar');
    } finally {
      setCancelando(false);
      setConfirmarLiberar(false);
    }
  }

  async function handleToggleDisponible(platoId: string, actual: boolean) {
    try {
      await api.menu.toggleDisponible(platoId, !actual);
      setMenu((prev) =>
        prev.map((p) => (p.id === platoId ? { ...p, disponible: !actual } : p)),
      );
      toast.success(!actual ? 'Plato disponible' : 'Plato no disponible');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  }

  // Consumo total pendiente de cobro (lo que no fue cancelado)
  const consumoPendiente = (visita?.pedidos ?? [])
    .filter((p) => p.estado !== 'cancelado')
    .reduce(
      (s, p) =>
        s +
        p.items.reduce(
          (acc, i) => acc + parseFloat(i.precioUnitarioCongelado) * i.cantidad,
          0,
        ),
      0,
    );

  // Mesa liberable sin pago si no hay consumo (sin rondas o todas canceladas).
  const mesaLiberableSinPago = consumoPendiente === 0;
  // Hay consumo pendiente → se debe cobrar antes de liberar.
  const tieneConsumoNoCobrado = consumoPendiente > 0;

  async function handleImprimirCuenta() {
    if (!visita) return;
    setImprimiendo(true);
    try {
      await api.visitas.imprimirCuenta(visita.id);
      toast.success('Cuenta enviada a impresora');
      setModalCobro(true);
      // Inicializar con el total como monto por defecto
      setCobrandoPagos([{ metodo: 'efectivo', monto: visita.total }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al imprimir cuenta');
    } finally {
      setImprimiendo(false);
    }
  }

  const totalCobrandoPagos = cobrandoPagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

  async function handleRegistrarPago() {
    if (!visita) return;
    const pagos = cobrandoPagos.filter((p) => parseFloat(p.monto) > 0);
    if (!pagos.length) { toast.error('Ingresa al menos un método de pago'); return; }
    setCobrando(true);
    try {
      await api.visitas.pagarMesero(
        visita.id,
        pagos.map((p) => ({ metodoPago: p.metodo, monto: parseFloat(p.monto) })),
      );
      toast.success('Cobro registrado — mesa liberada');
      router.push('/mesero');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar cobro');
    } finally {
      setCobrando(false);
    }
  }

  if (!visita) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando mesa…
      </div>
    );
  }

  const mesaNumero = '—'; // el backend no devuelve número en visita; lo obtenemos del título

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Overlay carta */}
      {cartaAbierta && (
        <div className="fixed inset-0 z-50 bg-[var(--piedra)] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[var(--ink)] text-white">
            <p className="font-semibold text-sm">Carta — {process.env.NEXT_PUBLIC_STORE_NAME || "FoxEats"}</p>
            <button
              onClick={() => setCartaAbierta(false)}
              className="text-white/70 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div ref={cartaRef} className="p-5 space-y-6 max-w-lg mx-auto">
            {categoriasLista.map((cat) => {
              const items = menu.filter(
                (p) => p.activo && p.disponible && (p.categoriaId === cat.id || p.categoria?.id === cat.id),
              );
              if (!items.length) return null;
              return (
                <section key={cat.id}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{cat.nombre}</h3>
                  <div className="rounded-2xl border border-border bg-white overflow-hidden divide-y divide-border">
                    {items.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3">
                        <p className="font-medium text-sm text-[var(--ink)]">{p.nombre}</p>
                        <PrecioPlato plato={p} promo={promoPorPlato.get(p.id)} grande />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de cobro */}
      {modalCobro && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[var(--ink)]">Registrar cobro</h2>
              <button onClick={() => setModalCobro(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-[var(--ink)]">S/{visita.total}</span></p>

            <div className="space-y-3">
              {cobrandoPagos.map((pago, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={pago.metodo}
                    onChange={(e) => {
                      const next = [...cobrandoPagos];
                      next[idx] = { ...next[idx], metodo: e.target.value as typeof pago.metodo };
                      setCobrandoPagos(next);
                    }}
                    className="flex-1 text-sm rounded-lg border border-border px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--alerta)]"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="yape_plin">Yape / Plin</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="S/0.00"
                    value={pago.monto}
                    onChange={(e) => {
                      const next = [...cobrandoPagos];
                      next[idx] = { ...next[idx], monto: e.target.value };
                      setCobrandoPagos(next);
                    }}
                    className="w-24 text-sm rounded-lg border border-border px-3 py-2 text-right focus:outline-none focus:ring-1 focus:ring-[var(--alerta)]"
                  />
                  {cobrandoPagos.length > 1 && (
                    <button
                      onClick={() => setCobrandoPagos(cobrandoPagos.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-[var(--alerta)] text-lg leading-none"
                    >×</button>
                  )}
                </div>
              ))}
            </div>

            {cobrandoPagos.length < 3 && (
              <button
                onClick={() => setCobrandoPagos([...cobrandoPagos, { metodo: 'efectivo', monto: '' }])}
                className="text-xs text-[var(--alerta)] hover:underline"
              >
                + Agregar método de pago
              </button>
            )}

            {cobrandoPagos.length > 1 && (
              <p className={['text-xs font-medium', Math.abs(totalCobrandoPagos - parseFloat(visita.total)) > 0.01 ? 'text-[var(--alerta)]' : 'text-[var(--ok)]'].join(' ')}>
                Total ingresado: S/{totalCobrandoPagos.toFixed(2)}
                {Math.abs(totalCobrandoPagos - parseFloat(visita.total)) > 0.01 && ` (faltan S/${(parseFloat(visita.total) - totalCobrandoPagos).toFixed(2)})`}
              </p>
            )}

            <Button
              className="w-full h-12 text-base bg-[var(--alerta)] hover:bg-[var(--alerta-hover)] text-white disabled:opacity-40"
              disabled={cobrando || Math.abs(totalCobrandoPagos - parseFloat(visita.total)) > 0.01}
              onClick={handleRegistrarPago}
            >
              {cobrando ? 'Registrando…' : 'Confirmar cobro'}
            </Button>
          </div>
        </div>
      )}

      {/* Banner: visita de delivery o para llevar */}
      {visita.tipo === 'delivery' ? (
        <div className="flex flex-col px-5 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🛵</span>
            <span className="text-xs font-semibold text-blue-700">
              Delivery {visita.nombreCliente ? `— ${visita.nombreCliente}` : ''} {visita.telefonoCliente ? `(${visita.telefonoCliente})` : ''}
            </span>
          </div>
          {visita.direccionDelivery && (
            <p className="text-xs text-blue-600 mt-0.5 ml-6">
              Dirección: {visita.direccionDelivery}
            </p>
          )}
        </div>
      ) : visita.tipo === 'llevar' ? (
        <div className="flex items-center gap-2 px-5 py-2 bg-[var(--tinta)]/10 border-b border-[var(--tinta)]/30">
          <span className="text-base leading-none">🥡</span>
          <span className="text-xs font-semibold text-[var(--tinta)]">
            Pedido para llevar {visita.nombreCliente ? `— ${visita.nombreCliente}` : ''}
          </span>
        </div>
      ) : null}

      {/* Sub-header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
        <button
          onClick={() => router.push('/mesero')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Mesas
        </button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total visita</p>
          <p className="font-bold text-[var(--ink)]">S/{visita.total}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* {tieneConsumoNoCobrado && (
            <button
              onClick={handleImprimirCuenta}
              disabled={imprimiendo}
              className="flex flex-col items-center gap-0.5 text-[var(--alerta)] hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <span className="text-lg leading-none">🧾</span>
              <span className="text-xs font-medium">{imprimiendo ? '…' : 'Cuenta'}</span>
            </button>
          )} */}
          <Button
            onClick={() => setConfirmarLiberar(true)}
            disabled={!mesaLiberableSinPago || cancelando}
            title={
              !mesaLiberableSinPago
                ? 'Hay consumo pendiente. Debe cobrarse en caja antes de liberar.'
                : undefined
            }
            className="bg-[var(--ok)] hover:bg-[var(--ok-hover)] text-white disabled:opacity-40"
          >
            {cancelando ? 'Liberando…' : 'Liberar mesa'}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">

        {/* ─── Izquierda: tomar pedido ─────────────────────────── */}
        <div className="flex flex-col border-r border-border overflow-hidden">
          {/* Buscador de platos */}
          <div className="p-4 border-b border-border bg-white flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
              <input
                type="text"
                placeholder="Buscar plato (ej: pollo papas)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 pr-8 py-2.5 rounded-xl border border-border bg-muted/20 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--alerta)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none font-semibold"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {promos.length > 0 && (
              <div className="rounded-xl bg-[var(--aji-tint)] px-3 py-2.5 text-xs text-[var(--ink)]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Tag className="size-3.5" strokeWidth={2} /> Promos ahora
                </p>
                <ul className="mt-1 space-y-0.5">
                  {promos.map((pr) => (
                    <li key={pr.id}>
                      <span className="font-semibold tabular-nums">{etiquetaDescuento(pr)}</span> {pr.nombre}
                      {pr.horaFin && <span className="text-[var(--pizarra)]"> · hasta las {pr.horaFin.slice(0, 5)}</span>}
                      <span className="text-[var(--pizarra)]"> · {pr.platoCartaIds.length} {pr.platoCartaIds.length === 1 ? 'plato' : 'platos'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {categoriasLista.map((cat) => {
              const platos = menu.filter(
                (p) => (p.categoriaId === cat.id || p.categoria?.id === cat.id) && matchesSearch(p.nombre),
              );
              if (platos.length === 0) return null;
              return (
                <section key={cat.id}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {cat.nombre}
                  </h3>
                  <div className="space-y-2">
                    {platos.map((plato) => {
                      const linea = lineas.get(plato.id);
                      return (
                        <div
                          key={plato.id}
                          className={[
                            'rounded-xl border bg-white p-3 space-y-2 transition-opacity',
                            !plato.disponible ? 'opacity-40' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={['font-medium text-sm leading-tight', !plato.disponible ? 'line-through' : ''].join(' ')}>
                                {plato.nombre}
                              </p>
                              <div className="flex items-center gap-2">
                                <PrecioPlato plato={plato} promo={promoPorPlato.get(plato.id)} />
                                {plato.quedan !== null && (
                                  plato.quedan <= 0 ? (
                                    <span className="text-xs font-medium text-[var(--alerta)]">Agotado</span>
                                  ) : (plato.quedan <= 5 || (plato.stockMinimo ?? 0) >= (plato.stockActual ?? 0)) && (
                                    <span className="rounded-full bg-[var(--aviso-tint)] px-2 py-px text-[11.5px] font-semibold text-[var(--aviso)]">
                                      {plato.quedan === 1 ? 'queda 1' : `quedan ${plato.quedan}`}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {plato.quedan === null && (
                                <button
                                  onClick={() => handleToggleDisponible(plato.id, plato.disponible)}
                                  className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                                >
                                  {plato.disponible ? 'No hay' : 'Hay'}
                                </button>
                              )}
                              <CantidadControl
                                max={Math.max(maximoPedible(plato), linea?.cantidad ?? 0)}
                                value={linea?.cantidad ?? 0}
                                onChange={(v) => setLinea(plato.id, { platoCartaId: plato.id, cantidad: v })}
                              />
                            </div>
                          </div>

                          {/* Nota — visible si hay cantidad o nota ya escrita */}
                          {((linea?.cantidad ?? 0) > 0 || linea?.notaAbierta) && (
                            <input
                              placeholder="Nota (sin ají, sin crema…)"
                              value={linea?.notas ?? ''}
                              onChange={(e) => setLinea(plato.id, { notas: e.target.value })}
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--alerta)]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Toggle "para llevar" + botón enviar — sticky */}
          <div className="p-4 border-t border-border bg-white space-y-3">
            {/* No mostrar toggle en visita ya marcada como "para llevar" entera */}
            {!visita.paraLlevar && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rondaParaLlevar}
                    onChange={(e) => {
                      setRondaParaLlevar(e.target.checked);
                      if (!e.target.checked) setNombreClienteLlevar('');
                    }}
                    className="h-4 w-4 accent-[var(--tinta)]"
                  />
                  <span className="text-sm font-medium text-[var(--ink)]">
                    🥡 Esta ronda es para llevar
                  </span>
                </label>
                {rondaParaLlevar && (
                  <input
                    type="text"
                    value={nombreClienteLlevar}
                    onChange={(e) => setNombreClienteLlevar(e.target.value)}
                    placeholder="Nombre del cliente (obligatorio)"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--tinta)]/40 bg-[var(--tinta)]/5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--tinta)]"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Si necesitas cobrar un tupper o bolsa, agrégalo desde la sección <span className="font-medium">Extras</span>.
                </p>
              </div>
            )}
            <Button
              className="w-full h-12 text-base bg-[var(--alerta)] hover:bg-[var(--alerta-hover)] text-white disabled:opacity-40"
              disabled={!puedeEnviar}
              onClick={handleEnviarPedido}
            >
              {enviando
                ? 'Enviando…'
                : itemsParaEnviar.length > 0
                  ? `Enviar a cocina · S/${totalPedido.toFixed(2)}`
                  : 'Enviar a cocina'}
            </Button>
          </div>
        </div>

        {/* ─── Derecha: rondas activas ──────────────────────────── */}
        <div className="flex flex-col overflow-hidden bg-muted/5">
          {/* Borrador de Pedido */}
          {itemsParaEnviar.length > 0 && (
            <div className="border-b border-border bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--alerta)] flex items-center gap-1.5">
                  📝 Resumen del Pedido (Borrador)
                </h4>
                <button
                  onClick={() => setLineas(new Map())}
                  className="text-xs text-muted-foreground hover:text-[var(--alerta)] transition-colors underline"
                >
                  Vaciar borrador
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {itemsParaEnviar.map((item) => {
                  const plato = platoMap.get(item.platoCartaId);
                  return (
                    <div key={item.platoCartaId} className="flex items-start justify-between gap-3 bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-sm text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                            {item.cantidad}x
                          </span>
                          <p className="font-medium text-[var(--ink)] truncate">
                            {plato?.nombre}
                          </p>
                        </div>
                        {item.notas && (
                          <p className="text-muted-foreground italic mt-1 ml-7 truncate">
                            "{item.notas}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[var(--ink)]">
                          S/{(precioFinal(plato) * item.cantidad).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setLinea(item.platoCartaId, { cantidad: 0, notas: '' })}
                          className="text-muted-foreground hover:text-[var(--alerta)] text-sm px-1"
                          title="Eliminar del borrador"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b border-border bg-white">
            <h3 className="text-sm font-semibold text-[var(--ink)]">
              Rondas activas
              {visita.pedidos.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">
                  ({visita.pedidos.length})
                </span>
              )}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {visita.pedidos.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm pt-8">
                Sin pedidos aún
              </p>
            ) : (
              [...visita.pedidos]
                .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
                .map((pedido) => (
                  <RondaCard
                    key={pedido.id}
                    pedido={pedido}
                    platoMap={platoMap}
                    onCancelar={(id) => setPedidoPorCancelar(id)}
                    onCancelarItem={iniciarCancelarItem}
                    cargando={marcando !== null}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      <CancelarRondaDialog
        open={!!pedidoPorCancelar}
        loading={!!marcando}
        onConfirm={confirmarCancelarRonda}
        onCancel={() => setPedidoPorCancelar(null)}
      />

      <ConfirmDialog
        open={!!itemPorCancelar}
        title="¿Cancelar producto?"
        description="El producto se anulará de esta ronda y su subtotal se descontará de la cuenta de la mesa."
        confirmLabel="Sí, cancelar"
        cancelLabel="No, mantener"
        variant="destructive"
        loading={marcando !== null}
        onConfirm={confirmarCancelarItem}
        onCancel={() => setItemPorCancelar(null)}
      />

      <ConfirmDialog
        open={confirmarLiberar}
        title={visita.paraLlevar ? 'Cerrar pedido para llevar' : 'Liberar mesa'}
        description={
          visita.paraLlevar
            ? 'El pedido quedará cerrado y no podrá agregarse más a esta visita.'
            : 'La mesa quedará libre para recibir nuevos clientes.'
        }
        confirmLabel={visita.paraLlevar ? 'Cerrar pedido' : 'Liberar mesa'}
        loading={cancelando}
        onConfirm={ejecutarLiberarMesa}
        onCancel={() => setConfirmarLiberar(false)}
      />
    </div>
  );
}

/** Precio del plato; con promo vigente muestra el normal tachado, el final y la etiqueta. */
function PrecioPlato({ plato, promo, grande = false }: { plato: PlatoCarta; promo?: PromocionVigente; grande?: boolean }) {
  const base = parseFloat(plato.precio);
  if (!promo) {
    return grande
      ? <p className="text-sm font-semibold text-[var(--ink)]">S/{plato.precio}</p>
      : <span className="text-xs text-muted-foreground">S/{plato.precio}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums" title={promo.nombre}>
      <s className="text-xs text-muted-foreground">S/{base.toFixed(2)}</s>
      <span className={grande ? 'text-sm font-semibold text-[var(--ink)]' : 'text-xs font-semibold text-[var(--ink)]'}>
        S/{precioConPromo(base, promo).toFixed(2)}
      </span>
      <span className="whitespace-nowrap rounded bg-[var(--aji)] px-1 py-px text-[10.5px] font-bold text-[var(--ink)]">{etiquetaDescuento(promo)}</span>
    </span>
  );
}

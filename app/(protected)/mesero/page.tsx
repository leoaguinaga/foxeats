'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Mesa, Zona } from '@/lib/types';
import { MesaCard } from '@/components/mesero/MesaCard';
import { etiquetaCorta, etiquetaMesa } from '@/lib/mesas';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';

export default function MeseroHome() {
  const router = useRouter();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [abriendoLlevar, setAbriendoLlevar] = useState(false);
  const [llevarDialogAbierto, setLlevarDialogAbierto] = useState(false);
  const [mesaPorAbrir, setMesaPorAbrir] = useState<Mesa | null>(null);
  const [tabActivo, setTabActivo] = useState<'salon' | 'llevar_delivery'>('salon');
  const [pedidosExternos, setPedidosExternos] = useState<Array<{
    id: string;
    tipo: 'llevar' | 'delivery';
    nombreCliente: string | null;
    telefonoCliente: string | null;
    direccionDelivery: string | null;
    costoEnvio: string | null;
    fechaApertura: string;
    total: string;
    cantidadItems: number;
  }>>([]);

  const fetchMesas = useCallback(async () => {
    try {
      const [data, zs] = await Promise.all([api.mesas.list(), api.zonas.list()]);
      // Excluir la mesa virtual 0 (para llevar) de la vista de mesas
      setMesas(data.filter((m) => m.numero !== 0));
      setZonas(zs);
    } catch {
      // silencioso en polling
    } finally {
      setCargando(false);
    }
  }, []);

  const fetchPedidosExternos = useCallback(async () => {
    try {
      const data = await api.visitas.activeLlevarDelivery();
      setPedidosExternos(data);
    } catch {
      // silencioso en polling
    }
  }, []);

  useEffect(() => {
    fetchMesas();
    fetchPedidosExternos();
    const interval = setInterval(() => {
      fetchMesas();
      fetchPedidosExternos();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMesas, fetchPedidosExternos]);

  async function handleMesaClick(mesa: Mesa) {
    if (mesa.estado === 'ocupada') {
      try {
        const visita = await api.mesas.visitaActiva(mesa.id);
        router.push(`/mesero/mesa/${visita.id}`);
      } catch {
        toast.error('No se encontró la visita activa');
      }
      return;
    }

    setMesaPorAbrir(mesa);
  }

  async function confirmarAbrirMesa() {
    if (!mesaPorAbrir) return;
    const mesa = mesaPorAbrir;
    setAbriendo(mesa.id);
    try {
      const visita = await api.mesas.abrir(mesa.id);
      toast.success(`${etiquetaMesa(mesa, mesas)} abierta`);
      setMesaPorAbrir(null);
      router.push(`/mesero/mesa/${visita.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir mesa');
    } finally {
      setAbriendo(null);
    }
  }

  function handleParaLlevar() {
    setLlevarDialogAbierto(true);
  }

  async function confirmarParaLlevar(nombreCliente: string) {
    setLlevarDialogAbierto(false);
    setAbriendoLlevar(true);
    try {
      const visita = await api.visitas.abrirParaLlevar({ nombreCliente });
      toast.success('Pedido para llevar abierto');
      router.push(`/mesero/mesa/${visita.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir pedido para llevar');
    } finally {
      setAbriendoLlevar(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Cargando mesas…
      </div>
    );
  }

  // Zonas: cada mesa pertenece a una; sin zona válida cae en la primera.
  const zona = zonas.find((z) => z.id === zonaActiva) ?? zonas[0] ?? null;
  const zonaDe = (m: Mesa) => (m.zonaId && zonas.some((z) => z.id === m.zonaId) ? m.zonaId : zonas[0]?.id ?? null);
  const mesasZona = zona ? mesas.filter((m) => zonaDe(m) === zona.id) : mesas;
  const libres = mesasZona.filter((m) => m.estado === 'libre').length;

  // Si la zona usa plano y tiene mesas ubicadas, se dibuja la matriz (con
  // referencias como Entrada o Barra). Si no, grid por número.
  const conPosicion = mesasZona.filter((m) => m.filaPosicion !== null && m.colPosicion !== null);
  const sinPosicion = mesasZona
    .filter((m) => m.filaPosicion === null || m.colPosicion === null)
    .sort((a, b) => a.numero - b.numero);
  const usarMatriz = (zona?.modo ?? 'plano') === 'plano' && conPosicion.length > 0;
  const referencias = usarMatriz ? zona?.referencias ?? [] : [];

  const filas = usarMatriz
    ? Math.max(...conPosicion.map((m) => m.filaPosicion!), ...referencias.map((r) => r.fila + (r.alto ?? 1) - 1)) + 1
    : 0;
  const cols = usarMatriz
    ? Math.max(...conPosicion.map((m) => m.colPosicion! + (m.ancho ?? 1) - 1), ...referencias.map((r) => r.col + r.ancho - 1)) + 1
    : 0;
  const porNumero = [...mesasZona].sort((a, b) => a.numero - b.numero);

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--ink)]">{process.env.NEXT_PUBLIC_STORE_NAME || "FoxEats"}</h2>
        <span className="text-xs font-medium text-muted-foreground bg-white border border-border px-2.5 py-1 rounded-full">
          Mesero
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTabActivo('salon')}
          className={[
            'flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all',
            tabActivo === 'salon'
              ? 'border-[var(--alerta)] text-[var(--alerta)]'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          🪑 Salón
        </button>
        <button
          onClick={() => setTabActivo('llevar_delivery')}
          className={[
            'flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all',
            tabActivo === 'llevar_delivery'
              ? 'border-[var(--alerta)] text-[var(--alerta)]'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          🥡 Llevar / 🛵 Delivery ({pedidosExternos.length})
        </button>
      </div>

      {tabActivo === 'salon' ? (
        <>
          {zonas.length > 1 && (
            <div role="tablist" aria-label="Zonas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {zonas.map((z) => {
                const on = z.id === zona?.id;
                const libresZona = mesas.filter((m) => zonaDe(m) === z.id && m.estado === 'libre').length;
                return (
                  <button
                    key={z.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setZonaActiva(z.id)}
                    className={[
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                      on
                        ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white'
                        : 'border-border bg-white text-[var(--ink)] hover:bg-muted',
                    ].join(' ')}
                  >
                    {z.nombre}
                    <span className={on ? 'ml-1.5 font-medium text-white/70' : 'ml-1.5 font-medium text-muted-foreground'}>
                      {libresZona} libre{libresZona !== 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{zona && zonas.length > 1 ? zona.nombre : 'Distribución del salón'}</h3>
            <span className="text-xs text-muted-foreground font-medium">
              {libres} libre{libres !== 1 ? 's' : ''} · {mesasZona.length - libres} ocupada{mesasZona.length - libres !== 1 ? 's' : ''}
            </span>
          </div>

          {usarMatriz ? (
            <div className="space-y-4">
              <div className="-mx-1 overflow-x-auto px-1">
              <div
                className="rounded-2xl bg-[var(--piedra)] p-3"
                style={{
                  display: 'grid',
                  // Ancho mínimo por mesa: en teléfono el plano se desplaza en vez de apretarse
                  gridTemplateColumns: `repeat(${cols}, minmax(104px, 1fr))`,
                  minWidth: cols * 116,
                  gridTemplateRows: `repeat(${filas}, auto)`,
                  gap: '0.75rem',
                }}
              >
                {referencias.map((r) => (
                  <div
                    key={r.id}
                    aria-hidden
                    style={{ gridRow: `${r.fila + 1} / span ${r.alto ?? 1}`, gridColumn: `${r.col + 1} / span ${r.ancho}` }}
                    className="flex min-h-[64px] items-center justify-center rounded-2xl px-2 text-xs font-semibold text-muted-foreground [background:repeating-linear-gradient(135deg,#EFEDE6_0_6px,#E6E3DA_6px_12px)]"
                  >
                    <span className="truncate">{r.etiqueta}</span>
                  </div>
                ))}
                {conPosicion.map((mesa) => (
                  <div
                    key={mesa.id}
                    style={{ gridRow: mesa.filaPosicion! + 1, gridColumn: `${mesa.colPosicion! + 1} / span ${mesa.ancho ?? 1}` }}
                    className={abriendo === mesa.id ? 'opacity-50 pointer-events-none' : ''}
                  >
                    <MesaCard mesa={mesa} etiqueta={mesa.tipo === 'barra' ? etiquetaCorta(mesa, mesas) : undefined} onClick={() => handleMesaClick(mesa)} />
                  </div>
                ))}
              </div>
              </div>

              {/* Mesas sin posición — listado al final */}
              {sinPosicion.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sin ubicar</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {sinPosicion.map((mesa) => (
                      <div key={mesa.id} className={abriendo === mesa.id ? 'opacity-50 pointer-events-none' : ''}>
                        <MesaCard mesa={mesa} etiqueta={mesa.tipo === 'barra' ? etiquetaCorta(mesa, mesas) : undefined} onClick={() => handleMesaClick(mesa)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleParaLlevar}
                disabled={abriendoLlevar}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--tinta)] bg-[var(--tinta)]/5 hover:bg-[var(--tinta)]/10 transition-colors p-4 min-h-[64px] disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="text-2xl leading-none">🥡</span>
                <span className="text-sm font-semibold text-[var(--tinta)]">
                  {abriendoLlevar ? 'Abriendo…' : 'Para llevar'}
                </span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {porNumero.map((mesa) => (
                <div key={mesa.id} className={abriendo === mesa.id ? 'opacity-50 pointer-events-none' : ''}>
                  <MesaCard mesa={mesa} etiqueta={mesa.tipo === 'barra' ? etiquetaCorta(mesa, mesas) : undefined} onClick={() => handleMesaClick(mesa)} />
                </div>
              ))}

              {/* Botón Para llevar — siempre al final del grid */}
              <button
                onClick={handleParaLlevar}
                disabled={abriendoLlevar}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--tinta)] bg-[var(--tinta)]/5 hover:bg-[var(--tinta)]/10 transition-colors p-4 h-full min-h-[100px] disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="text-2xl leading-none">🥡</span>
                <span className="text-sm font-semibold text-[var(--tinta)]">
                  {abriendoLlevar ? 'Abriendo…' : 'Para llevar'}
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Botón Para llevar */}
          <button
            onClick={handleParaLlevar}
            disabled={abriendoLlevar}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--tinta)] bg-[var(--tinta)]/5 hover:bg-[var(--tinta)]/10 transition-colors p-4 min-h-[64px] disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="text-2xl leading-none">🥡</span>
            <span className="text-sm font-semibold text-[var(--tinta)]">
              {abriendoLlevar ? 'Abriendo…' : 'Nuevo pedido para llevar'}
            </span>
          </button>

          {/* List of active external orders */}
          {pedidosExternos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-white rounded-2xl border border-border p-6">
              <p className="text-base font-semibold">Sin pedidos externos activos</p>
              <p className="text-xs mt-1">Los pedidos para llevar o delivery aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pedidosExternos.map((pedido) => {
                const hora = new Date(pedido.fechaApertura).toLocaleTimeString('es-PE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });
                return (
                  <div
                    key={pedido.id}
                    onClick={() => router.push(`/mesero/mesa/${pedido.id}`)}
                    className="flex flex-col justify-between p-4 rounded-xl border border-border bg-white hover:border-[var(--tinta)] cursor-pointer transition-all active:scale-[0.98] shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={[
                        'text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5',
                        pedido.tipo === 'delivery'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-[var(--tinta)]/20 text-[var(--tinta)]'
                      ].join(' ')}>
                        {pedido.tipo === 'delivery' ? '🛵 Delivery' : '🥡 Para llevar'}
                      </span>
                      <span className="text-xs text-muted-foreground">{hora}</span>
                    </div>

                    <div className="space-y-1">
                      <p className="font-bold text-sm text-[var(--ink)] leading-none">
                        {pedido.nombreCliente ?? 'Cliente sin nombre'}
                      </p>
                      {pedido.tipo === 'delivery' && pedido.direccionDelivery && (
                        <p className="text-xs text-muted-foreground truncate">
                          Dir: {pedido.direccionDelivery}
                        </p>
                      )}
                      {pedido.telefonoCliente && (
                        <p className="text-xs text-muted-foreground leading-none">
                          Telf: {pedido.telefonoCliente}
                        </p>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-2 border-t border-border/60">
                      <span className="text-xs text-muted-foreground">
                        {pedido.cantidadItems} {pedido.cantidadItems === 1 ? 'producto' : 'productos'}
                      </span>
                      <span className="text-sm font-bold text-[var(--ink)]">
                        S/{pedido.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!mesaPorAbrir}
        title={mesaPorAbrir ? `Abrir ${mesaPorAbrir.tipo === 'barra' ? `${etiquetaMesa(mesaPorAbrir, mesas)} (Nº ${mesaPorAbrir.numero})` : `mesa ${mesaPorAbrir.numero}`}` : ''}
        description="Se abrirá una nueva visita y la mesa quedará ocupada."
        confirmLabel="Abrir mesa"
        loading={!!abriendo}
        onConfirm={confirmarAbrirMesa}
        onCancel={() => setMesaPorAbrir(null)}
      />

      <NombreClienteDialog
        open={llevarDialogAbierto}
        loading={abriendoLlevar}
        onConfirm={confirmarParaLlevar}
        onCancel={() => setLlevarDialogAbierto(false)}
      />
    </div>
  );
}

interface NombreClienteDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: (nombre: string) => void;
  onCancel: () => void;
}

function NombreClienteDialog({ open, loading, onConfirm, onCancel }: NombreClienteDialogProps) {
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    if (open) setNombre('');
  }, [open]);

  if (!open) return null;

  const nombreLimpio = nombre.trim();
  const puedeConfirmar = nombreLimpio.length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="font-bold text-[var(--ink)] text-lg">Nuevo pedido para llevar</h2>
          <p className="text-xs text-muted-foreground">Por favor, ingresa el nombre del cliente para identificar el pedido.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre del cliente *</label>
          <input
            type="text"
            placeholder="Ej: Juan Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={loading}
            autoFocus
            className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tinta)] bg-white text-[var(--ink)] font-medium"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <Button
            onClick={() => onConfirm(nombreLimpio)}
            disabled={!puedeConfirmar}
            className="bg-[var(--tinta)] hover:bg-[var(--tinta-hover)] text-white font-semibold disabled:opacity-40"
          >
            {loading ? 'Abriendo…' : 'Iniciar pedido'}
          </Button>
        </div>
      </div>
    </div>
  );
}

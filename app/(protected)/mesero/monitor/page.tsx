'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, MonitorItem } from '@/lib/api';
import { PlatoCarta } from '@/lib/types';
import { EstadoBadge } from '@/components/mesero/EstadoBadge';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';

const ALERTA_MINUTOS = 15;

function MinutosChip({ minutos }: { minutos: number }) {
  const alerta = minutos >= ALERTA_MINUTOS;
  return (
    <span
      className={[
        'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        alerta
          ? 'bg-[var(--alerta)] text-white animate-pulse'
          : 'bg-muted text-muted-foreground',
      ].join(' ')}
    >
      <Clock size={11} />
      {minutos}min
    </span>
  );
}

export default function MonitorPage() {
  const router = useRouter();
  const [rondas, setRondas] = useState<MonitorItem[]>([]);
  const [menu, setMenu] = useState<PlatoCarta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);

  const platoMap = new Map(menu.map((p) => [p.id, p]));

  const fetchData = useCallback(async () => {
    try {
      const [monitor, carta] = await Promise.all([
        api.monitor.get(),
        api.menu.list(),
      ]);
      // Ordenar: más antiguas primero (mayor espera arriba)
      setRondas(monitor.sort((a, b) => b.minutosEspera - a.minutosEspera));
      setMenu(carta);
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, [fetchData]);

  async function handleEntregado(pedidoId: string) {
    setMarcando(pedidoId);
    try {
      await api.pedidos.cambiarEstado(pedidoId, 'entregado');
      toast.success('Marcado como entregado');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setMarcando(null);
    }
  }

  if (cargando) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando monitor…</div>;
  }

  const pendientes = rondas.filter((r) => r.estado === 'pendiente' || r.estado === 'en_preparacion');
  const listos    = rondas.filter((r) => r.estado === 'listo');

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-[var(--ink)]">Monitor</h2>
        <span className="text-xs text-muted-foreground">
          {rondas.length} ronda{rondas.length !== 1 ? 's' : ''} activa{rondas.length !== 1 ? 's' : ''}
          {rondas.filter((r) => r.minutosEspera >= ALERTA_MINUTOS).length > 0 && (
            <span className="ml-2 text-[var(--alerta)] font-semibold">
              · {rondas.filter((r) => r.minutosEspera >= ALERTA_MINUTOS).length} en alerta
            </span>
          )}
        </span>
      </div>

      {rondas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-2">
          <span className="text-4xl">✓</span>
          <p className="font-medium">Sin rondas pendientes</p>
          <p className="text-sm">Todas las mesas están al día</p>
        </div>
      )}

      {/* Listos — acción inmediata requerida */}
      {listos.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--tinta)] mb-3">
            ¡Listos para entregar ({listos.length})
          </h3>
          <div className="space-y-3">
            {listos.map((r) => (
              <RondaMonitorCard
                key={r.pedidoId}
                ronda={r}
                platoMap={platoMap}
                onEntregado={() => handleEntregado(r.pedidoId)}
                onVerMesa={() => router.push(`/mesero/mesa/${r.visitaId}`)}
                cargando={marcando === r.pedidoId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pendientes / en preparación */}
      {pendientes.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            En cocina ({pendientes.length})
          </h3>
          <div className="space-y-3">
            {pendientes.map((r) => (
              <RondaMonitorCard
                key={r.pedidoId}
                ronda={r}
                platoMap={platoMap}
                onVerMesa={() => router.push(`/mesero/mesa/${r.visitaId}`)}
                cargando={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RondaMonitorCard({
  ronda,
  platoMap,
  onEntregado,
  onVerMesa,
  cargando,
}: {
  ronda: MonitorItem;
  platoMap: Map<string, PlatoCarta>;
  onEntregado?: () => void;
  onVerMesa: () => void;
  cargando: boolean;
}) {
  const hora = new Date(ronda.fechaCreacion).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      className={[
        'rounded-xl border bg-white p-4 space-y-3',
        ronda.minutosEspera >= ALERTA_MINUTOS ? 'border-[var(--alerta)]' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[var(--ink)]">
            Mesa {ronda.mesaNumero}
          </span>
          <MinutosChip minutos={ronda.minutosEspera} />
        </div>
        <div className="flex items-center gap-2">
          <EstadoBadge estado={ronda.estado as never} />
          <button
            onClick={onVerMesa}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Ver mesa"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Tomada a las {hora}</p>

      <ul className="space-y-1">
        {ronda.items.map((item, i) => {
          const nombre = platoMap.get(item.platoCartaId)?.nombre ?? item.platoCartaId;
          return (
            <li key={i} className="text-sm">
              <span className="font-medium">{item.cantidad}×</span> {nombre}
              {item.notas && (
                <span className="ml-2 text-xs text-muted-foreground italic">→ {item.notas}</span>
              )}
            </li>
          );
        })}
      </ul>

      {onEntregado && (
        <Button
          size="sm"
          onClick={onEntregado}
          disabled={cargando}
          className="w-full bg-[var(--ok)] hover:bg-[var(--ok-hover)] text-white"
        >
          Marcar entregado
        </Button>
      )}
    </div>
  );
}

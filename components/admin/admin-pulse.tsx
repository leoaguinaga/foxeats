'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, InsumoStock, PrinterInfo, TurnoResumen, UltimoConteo } from '@/lib/api';
import { estadoStock } from './stock/stock';

// Estado compartido por el shell y las páginas de administración:
// turno de caja, ticketeras y stock. Se consulta una sola vez por ciclo.
interface AdminPulse {
  turnos: TurnoResumen[] | null;
  ticketeras: PrinterInfo[] | null;
  stock: InsumoStock[] | null;
  turnoAbierto: TurnoResumen | undefined;
  ticketerasCaidas: PrinterInfo[];
  insumosAgotados: InsumoStock[];
  insumosPorReponer: InsumoStock[];
  /** undefined = aún no se sabe; null = nunca se contó. */
  ultimoConteo: UltimoConteo | null | undefined;
  /** Pasaron más de dos días sin contar (o nunca se contó). */
  conteoVencido: boolean;
  refrescar: () => Promise<void>;
}

const PulseContext = createContext<AdminPulse | null>(null);

const INTERVALO_MS = 30_000;

export function AdminPulseProvider({ children }: { children: React.ReactNode }) {
  const [turnos, setTurnos]         = useState<TurnoResumen[] | null>(null);
  const [ticketeras, setTicketeras] = useState<PrinterInfo[] | null>(null);
  const [stock, setStock]           = useState<InsumoStock[] | null>(null);
  const [ultimoConteo, setUltimoConteo] = useState<UltimoConteo | null | undefined>(undefined);
  const [conteoVencido, setConteoVencido] = useState(false);

  const refrescar = useCallback(async () => {
    const [t, p, s, c] = await Promise.allSettled([
      api.admin.caja(),
      api.ticketeras.list(),
      api.admin.getStock(),
      api.admin.ultimoConteo(),
    ]);
    if (t.status === 'fulfilled') setTurnos(t.value.turnos);
    if (p.status === 'fulfilled') setTicketeras(p.value);
    if (s.status === 'fulfilled') setStock(s.value);
    if (c.status === 'fulfilled') {
      setUltimoConteo(c.value);
      setConteoVencido(!c.value || Date.now() - new Date(c.value.createdAt).getTime() > 2 * 86_400_000);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    refrescar();
    const id = setInterval(refrescar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [refrescar]);

  const value: AdminPulse = {
    turnos,
    ticketeras,
    stock,
    ultimoConteo,
    conteoVencido,
    turnoAbierto: turnos?.find((t) => t.estado === 'abierto'),
    ticketerasCaidas: (ticketeras ?? []).filter((p) => p.modo === 'red' && !p.online),
    insumosAgotados: (stock ?? []).filter((i) => i.activo && i.stockActual <= 0),
    insumosPorReponer: (stock ?? []).filter((i) => i.activo && estadoStock(i).k === 'rep'),
    refrescar,
  };

  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}

export function useAdminPulse() {
  const ctx = useContext(PulseContext);
  if (!ctx) throw new Error('useAdminPulse fuera de AdminPulseProvider');
  return ctx;
}

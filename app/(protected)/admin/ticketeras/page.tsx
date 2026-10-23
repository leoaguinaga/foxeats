'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChefHat, FlaskConical, Printer, ReceiptText, RefreshCw, type LucideIcon } from 'lucide-react';
import { api, ModoTicketera, PrinterInfo } from '@/lib/api';

type Tipo = 'cocina' | 'recibos';

interface Borrador {
  modo: ModoTicketera;
  ip: string;
  puerto: string;
}

const TIPO_ICON: Record<string, LucideIcon> = {
  cocina:  ChefHat,
  recibos: ReceiptText,
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function errorIp(ip: string): string | null {
  const v = ip.trim();
  return v && !IPV4.test(v) ? 'IP no válida' : null;
}

function errorPuerto(puerto: string): string | null {
  const n = Number(puerto);
  return !puerto || n < 1 || n > 65535 ? 'Entre 1 y 65535' : null;
}

function aBorrador(t: PrinterInfo): Borrador {
  return { modo: t.modo, ip: t.ip ?? '', puerto: String(t.port) };
}

export default function AdminTicketerasPage() {
  const [ticketeras, setTicketeras] = useState<PrinterInfo[]>([]);
  // El borrador no se pisa con el sondeo cada 10 s: solo se reinicia al cargar o guardar.
  const [borradores, setBorradores] = useState<Partial<Record<Tipo, Borrador>>>({});
  const [cargando, setCargando]     = useState(true);
  const [probando, setProbando]     = useState<string | null>(null);
  const [guardando, setGuardando]   = useState<string | null>(null);

  const fetchTicketeras = useCallback(async () => {
    try {
      const data = await api.ticketeras.list();
      setTicketeras(data);
      setBorradores((prev) => {
        const next = { ...prev };
        for (const t of data) next[t.tipo] ??= aBorrador(t);
        return next;
      });
    } catch {
      /* silencioso */
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    fetchTicketeras();
    const id = setInterval(fetchTicketeras, 10000);
    return () => clearInterval(id);
  }, [fetchTicketeras]);

  function editar(tipo: Tipo, cambio: Partial<Borrador>) {
    setBorradores((prev) => ({ ...prev, [tipo]: { ...prev[tipo]!, ...cambio } }));
  }

  async function handleGuardar(t: PrinterInfo) {
    const b = borradores[t.tipo];
    if (!b) return;
    setGuardando(t.tipo);
    try {
      const data = await api.ticketeras.update(t.tipo, {
        modo: b.modo,
        ip: b.ip.trim() || null,
        puerto: Number(b.puerto),
      });
      setTicketeras(data);
      const guardada = data.find((x) => x.tipo === t.tipo);
      if (guardada) setBorradores((prev) => ({ ...prev, [t.tipo]: aBorrador(guardada) }));
      toast.success(`${t.label} actualizada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
    }
  }

  async function handleTestPrint(tipo: Tipo, label: string) {
    setProbando(tipo);
    try {
      await api.ticketeras.testPrint(tipo);
      toast.success(`Prueba enviada a ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al imprimir');
    } finally {
      setProbando(null);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--pizarra)]">
        Detectando ticketeras…
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Ticketeras en red</h2>
          <p className="text-sm text-[var(--pizarra)]">
            Puerto estándar ESC/POS LAN: <span className="font-mono tabular-nums">9100</span>. Los cambios aplican al siguiente ticket.
          </p>
        </div>
        <button
          onClick={fetchTicketeras}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--pizarra)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tinta)]/25"
        >
          <RefreshCw className="size-3.5" strokeWidth={1.9} />
          Actualizar
        </button>
      </div>

      <div className="space-y-3">
        {ticketeras.map((t) => {
          const b = borradores[t.tipo] ?? aBorrador(t);
          const Icono = TIPO_ICON[t.tipo] ?? Printer;
          const sinCambios =
            b.modo === t.modo && b.ip.trim() === (t.ip ?? '') && b.puerto === String(t.port);
          const errIp = errorIp(b.ip);
          const errPuerto = errorPuerto(b.puerto);
          return (
            <section
              key={t.tipo}
              aria-labelledby={`ticketera-${t.tipo}`}
              className="rounded-[10px] border border-[var(--linea)] bg-white"
            >
              {/* Estado */}
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="shrink-0 size-10 rounded-lg bg-[var(--tinta-tint)] text-[var(--tinta)] hidden sm:flex items-center justify-center">
                  <Icono className="size-5" strokeWidth={1.9} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 id={`ticketera-${t.tipo}`} className="font-semibold text-[var(--ink)]">{t.label}</h3>
                    <Estado t={t} />
                  </div>
                  <p className="text-sm text-[var(--pizarra)] truncate">
                    {t.ip ? (
                      <>
                        <span className="font-mono tabular-nums">{t.ip}:{t.port}</span>
                        {t.modo === 'red' && t.online && t.latencyMs !== undefined && (
                          <span className="tabular-nums"> · {t.latencyMs} ms</span>
                        )}
                      </>
                    ) : (
                      'Sin IP configurada'
                    )}
                  </p>
                </div>

                <button
                  onClick={() => handleTestPrint(t.tipo, t.label)}
                  disabled={!t.ip || probando === t.tipo}
                  title={t.ip ? 'Imprimir una página de prueba' : 'Configura una IP para probar'}
                  className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium px-3 h-9 rounded-lg border border-[var(--linea)] text-[var(--ink)] hover:bg-[var(--piedra)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tinta)]/25"
                >
                  <Printer className="size-4" strokeWidth={1.9} />
                  {probando === t.tipo ? 'Enviando…' : 'Prueba'}
                </button>
              </div>

              {/* Configuración */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGuardar(t);
                }}
                className="border-t border-[var(--linea)] px-4 pt-3.5 pb-3 space-y-3"
              >
                <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                  <Campo label="IP" error={errIp}>
                    <input
                      value={b.ip}
                      onChange={(e) => editar(t.tipo, { ip: e.target.value })}
                      placeholder="192.168.1.100"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={!!errIp}
                      className={inputClass(!!errIp)}
                    />
                  </Campo>
                  <Campo label="Puerto" error={errPuerto}>
                    <input
                      value={b.puerto}
                      onChange={(e) => editar(t.tipo, { puerto: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                      inputMode="numeric"
                      aria-invalid={!!errPuerto}
                      className={inputClass(!!errPuerto)}
                    />
                  </Campo>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 min-h-9">
                  <label className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-[var(--pizarra)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={b.modo === 'simulada'}
                      onChange={(e) => editar(t.tipo, { modo: e.target.checked ? 'simulada' : 'red' })}
                      className="size-3.5 accent-[var(--tinta)] cursor-pointer"
                    />
                    Simulada (no imprime)
                  </label>

                  {!sinCambios && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => editar(t.tipo, aBorrador(t))}
                        className="text-sm px-3 h-9 rounded-lg text-[var(--pizarra)] hover:text-[var(--ink)] hover:bg-[var(--piedra)] transition-colors"
                      >
                        Descartar
                      </button>
                      <button
                        type="submit"
                        disabled={!!errIp || !!errPuerto || guardando === t.tipo}
                        className="text-sm font-semibold px-4 h-9 rounded-lg bg-[var(--tinta)] hover:bg-[var(--tinta-hover)] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tinta)]/35 focus-visible:ring-offset-1"
                      >
                        {guardando === t.tipo ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function inputClass(invalido: boolean) {
  return [
    'w-full h-10 rounded-lg border bg-white px-3 font-mono text-sm tabular-nums text-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--pizarra)]/50',
    invalido
      ? 'border-[var(--alerta)] focus-visible:ring-2 focus-visible:ring-[var(--alerta)]/20'
      : 'border-[var(--linea)] focus-visible:border-[var(--tinta)] focus-visible:ring-2 focus-visible:ring-[var(--tinta)]/15',
  ].join(' ');
}

function Campo({ label, error, children }: { label: string; error: string | null; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[var(--pizarra)]">{label}</span>
      {children}
      {error && <span className="block text-xs text-[var(--alerta)]">{error}</span>}
    </label>
  );
}

function Estado({ t }: { t: PrinterInfo }) {
  if (t.modo === 'simulada') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--pizarra)]" title="No imprime: guarda el ticket como texto en el servidor">
        <FlaskConical className="size-3" strokeWidth={1.9} />
        simulada
      </span>
    );
  }
  if (!t.ip) {
    return <Pill color="aviso">Falta IP</Pill>;
  }
  return t.online ? <Pill color="ok">En línea</Pill> : <Pill color="alerta">Sin conexión</Pill>;
}

function Pill({ color, children }: { color: 'ok' | 'aviso' | 'alerta'; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `var(--${color}-tint)`, color: `var(--${color})` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: `var(--${color})` }} />
      {children}
    </span>
  );
}

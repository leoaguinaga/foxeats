'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Info } from 'lucide-react';
import { CampoTotal, ConteoBilletes, SelectorModo, useEfectivo } from './Efectivo';
import { api, type TurnoCaja, type TurnoResumen, type VisitaResumen } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { hoyLima, sumarDias, diaLima, hora, soles } from '@/components/admin/caja/fechas';

const ZONA = 'America/Lima';

function cuando(iso: string) {
  const dia = diaLima(iso);
  const hoy = hoyLima();
  if (dia === hoy) return `hoy, ${hora(iso)}`;
  if (dia === sumarDias(hoy, -1)) return `ayer, ${hora(iso)}`;
  const f = new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', timeZone: ZONA });
  return `${f}, ${hora(iso)}`;
}

function nombreCuenta(v: VisitaResumen) {
  if (v.tipo === 'llevar') return `Para llevar · ${v.nombreCliente ?? 'Cliente'}`;
  if (v.tipo === 'delivery') return `Delivery · ${v.nombreCliente ?? 'Cliente'}`;
  return `Mesa ${v.mesaNumero}`;
}

function useReloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

export function AbrirTurno({ onAbierto }: { onAbierto: (t: TurnoCaja) => void }) {
  const { data: sesion } = useSession();
  const ahora = useReloj();
  const inputRef = useRef<HTMLInputElement>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ef = useEfectivo(() => setError(null));

  // undefined = cargando · null = no hay cierres en los últimos 30 días
  const [ultimo, setUltimo] = useState<TurnoResumen | null | undefined>(undefined);
  const [cuentas, setCuentas] = useState<VisitaResumen[] | null>(null);

  useEffect(() => {
    const hoy = hoyLima();
    api.admin.caja({ desde: sumarDias(hoy, -30), hasta: hoy })
      .then((p) => {
        const cerrados = p.turnos
          .filter((t) => t.estado === 'cerrado' && t.fechaCierre)
          .sort((a, b) => b.fechaCierre!.localeCompare(a.fechaCierre!));
        setUltimo(cerrados[0] ?? null);
      })
      .catch(() => setUltimo(null));
    api.caja.visitasParaCobrar().then(setCuentas).catch(() => setCuentas(null));
  }, []);

  const valor = ef.valor;
  const valido = valor !== null;
  const contado = ultimo?.montoCierreReal != null ? parseFloat(ultimo.montoCierreReal) : null;
  const diferenciaConCierre = valido && contado !== null ? valor! - contado : null;

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) {
      setError(ef.modo === 'total' ? 'Escribe cuánto efectivo hay en la gaveta. Si está vacía, escribe 0.' : 'Cuenta al menos un billete o moneda.');
      inputRef.current?.focus();
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const turno = await api.caja.abrirTurno(Math.round(valor! * 100) / 100);
      toast.success(`Turno abierto con S/ ${soles(valor!)}`);
      onAbierto(turno);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el turno. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const fecha = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA });
  const horaActual = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
  const totalPorCobrar = cuentas?.reduce((s, v) => s + parseFloat(v.total), 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-[940px] px-4 py-8 md:px-6 md:py-14">
      <header className="mb-6 md:mb-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)] md:text-[32px]">Abrir turno</h1>
        <p className="mt-1 text-[15px] text-[var(--pizarra)]">
          {fecha.charAt(0).toUpperCase() + fecha.slice(1)}{', '}<time className="tabular-nums">{horaActual}</time>
          {sesion?.user?.name && <> · abre <span className="font-medium text-[var(--ink)]">{sesion.user.name}</span></>}
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <form onSubmit={abrir} noValidate className="rounded-[10px] border border-[var(--linea)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--linea)] px-5 py-4 md:px-6">
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">Efectivo en la gaveta</h2>
            <SelectorModo e={ef} />
          </div>

          <div className="px-5 py-5 md:px-6 md:py-6">
            {ef.modo === 'total' ? (
              <div>
                <CampoTotal e={ef} id="monto-apertura" etiqueta="Efectivo en la gaveta, en soles" error={!!error} errorId="apertura-error" inputRef={inputRef} autoFocus />

                {contado !== null && ultimo && (
                  <button
                    type="button"
                    onClick={() => { ef.setMonto(contado.toFixed(2)); inputRef.current?.focus(); }}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--linea)] bg-white px-3 py-1.5 text-[13px] text-[var(--ink)] transition-colors hover:border-[var(--tinta)] hover:bg-[var(--tinta-tint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
                  >
                    Igual al último cierre
                    <span className="whitespace-nowrap font-semibold tabular-nums">S/ {soles(contado)}</span>
                  </button>
                )}
              </div>
            ) : (
              <ConteoBilletes e={ef} />
            )}

            {diferenciaConCierre !== null && ultimo && (
              <p className="mt-4 flex items-start gap-2 text-[13px] text-[var(--pizarra)]">
                {Math.abs(diferenciaConCierre) < 0.005 ? (
                  <><Check className="mt-px size-4 shrink-0 text-[var(--ok)]" strokeWidth={1.9} aria-hidden />Coincide con lo que quedó al cerrar el último turno.</>
                ) : (
                  <><Info className="mt-px size-4 shrink-0 text-[var(--aviso)]" strokeWidth={1.9} aria-hidden />
                    S/ {soles(Math.abs(diferenciaConCierre))} {diferenciaConCierre < 0 ? 'menos' : 'más'} de lo que quedó al cerrar ({ultimo.cajeroNombre.split(' ')[0]}, {cuando(ultimo.fechaCierre!)}). Si alguien retiró o repuso efectivo, está bien.
                  </>
                )}
              </p>
            )}

            {error && (
              <p id="apertura-error" role="alert" className="mt-3 text-[13px] font-medium text-[var(--alerta)]">{error}</p>
            )}
          </div>

          <div className="border-t border-[var(--linea)] px-5 py-4 md:px-6">
            <button
              type="submit"
              disabled={enviando}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tinta)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
            >
              {enviando ? 'Abriendo turno…' : valido ? <>Abrir turno con <span className="tabular-nums">S/ {soles(valor!)}</span></> : 'Abrir turno'}
              {!enviando && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.9} aria-hidden />}
            </button>
          </div>
        </form>

        <aside className="space-y-7 text-[14px] lg:pt-1">
          <section aria-labelledby="ultimo-cierre">
            <h2 id="ultimo-cierre" className="mb-2.5 text-[13px] font-semibold text-[var(--ink)]">Último cierre</h2>
            {ultimo === undefined ? (
              <div className="space-y-2" aria-hidden>
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--linea)]/60" />
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--linea)]/60" />
              </div>
            ) : ultimo === null ? (
              <p className="text-[var(--pizarra)]">Sin cierres en los últimos 30 días.</p>
            ) : (
              <dl className="divide-y divide-[var(--linea)] border-y border-[var(--linea)]">
                <Fila t="Cerró">
                  {ultimo.cajeroNombre}
                  <span className="block text-[12.5px] font-normal text-[var(--pizarra)]">{cuando(ultimo.fechaCierre!)}</span>
                </Fila>
                <Fila t="Contó"><span className="tabular-nums">S/ {soles(ultimo.montoCierreReal ?? 0)}</span></Fila>
                <Fila t="Arqueo"><Arqueo diferencia={ultimo.diferencia} /></Fila>
              </dl>
            )}
          </section>

          {cuentas && (
            <section aria-labelledby="por-cobrar">
              <h2 id="por-cobrar" className="mb-2.5 text-[13px] font-semibold text-[var(--ink)]">Cuentas por cobrar</h2>
              {cuentas.length === 0 ? (
                <p className="text-[var(--pizarra)]">No hay cuentas abiertas.</p>
              ) : (
                <>
                  <p className="mb-2 text-[var(--pizarra)]">
                    {cuentas.length === 1 ? 'Una cuenta espera' : `${cuentas.length} cuentas esperan`} cobro por{' '}
                    <span className="font-medium text-[var(--ink)] tabular-nums">S/ {soles(totalPorCobrar)}</span>. Aparecerán al abrir el turno.
                  </p>
                  <ul className="divide-y divide-[var(--linea)] border-y border-[var(--linea)]">
                    {cuentas.slice(0, 5).map((v) => (
                      <li key={v.visitaId} className="flex items-baseline justify-between gap-3 py-2">
                        <span className="truncate text-[var(--ink)]">{nombreCuenta(v)}</span>
                        <span className="shrink-0 tabular-nums text-[var(--ink)]">S/ {soles(v.total)}</span>
                      </li>
                    ))}
                  </ul>
                  {cuentas.length > 5 && (
                    <p className="mt-2 text-[12.5px] text-[var(--pizarra)]">y {cuentas.length - 5} más</p>
                  )}
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fila({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[var(--pizarra)]">{t}</dt>
      <dd className="text-right font-medium text-[var(--ink)]">{children}</dd>
    </div>
  );
}

function Arqueo({ diferencia }: { diferencia: string | null }) {
  const d = diferencia == null ? 0 : parseFloat(diferencia);
  if (Math.abs(d) < 0.005) return <span className="text-[var(--ok)]">Cuadró</span>;
  return (
    <span className={['tabular-nums', d < 0 ? 'text-[var(--alerta)]' : 'text-[var(--aviso)]'].join(' ')}>
      {d < 0 ? 'Faltante' : 'Sobrante'} {d < 0 ? '−' : '+'}S/ {soles(Math.abs(d))}
    </span>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, X } from 'lucide-react';
import { api, type TurnoCaja, type VisitaResumen } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { CANALES, duracion, hora, soles } from '@/components/admin/caja/fechas';
import { CampoTotal, ConteoBilletes, SelectorModo, useEfectivo } from './Efectivo';

const num = (v: string | undefined | null) => parseFloat(v || '0') || 0;

/** Cierre del turno: contar la gaveta a la izquierda y ver el arqueo en vivo a la derecha. */
export function CierreTurno({ turno, visitas, ahora, onCerrado, onCancelar }: {
  turno: TurnoCaja;
  visitas: VisitaResumen[];
  ahora: string;
  onCerrado: () => void;
  onCancelar: () => void;
}) {
  const { data: sesion } = useSession();
  const esAdmin = (sesion?.user as { role?: string } | undefined)?.role === 'administracion';
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [sinConteoHoy, setSinConteoHoy] = useState(false);
  const ef = useEfectivo(() => setError(null));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sugerido, no obligatorio: avisa si hoy nadie contó el stock.
  useEffect(() => {
    api.admin.ultimoConteo().then((c) => {
      const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      setSinConteoHoy(!c || dia(new Date(c.createdAt)) !== dia(new Date()));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  const canal = turno.porCanal ?? { efectivo: '0.00', tarjeta: '0.00', yape_plin: '0.00', transferencia: '0.00' };
  const gastos = num(turno.totalGastos);
  const esperado = num(turno.montoCierreTeorico ?? turno.montoApertura);
  const contado = ef.valor;
  const diferencia = contado === null ? null : Math.round((contado - esperado) * 100) / 100;
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.005;
  const porCobrar = visitas.reduce((s, v) => s + num(v.total), 0);
  const cobros = turno.pagos?.length ?? 0;

  async function cerrar() {
    if (contado === null) {
      setError(ef.modo === 'total' ? 'Escribe cuánto efectivo contaste. Si la gaveta está vacía, escribe 0.' : 'Cuenta al menos un billete o moneda.');
      inputRef.current?.focus();
      return;
    }
    setCerrando(true);
    setError(null);
    try {
      await api.caja.cerrarTurno(Math.round(contado * 100) / 100);
      toast.success(cuadra ? 'Turno cerrado · la caja cuadra' : `Turno cerrado con ${diferencia! < 0 ? 'faltante' : 'sobrante'} de S/ ${soles(Math.abs(diferencia!))}`);
      onCerrado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar el turno. Intenta de nuevo.');
    } finally {
      setCerrando(false);
    }
  }

  const etiquetaBoton = cerrando
    ? 'Cerrando…'
    : diferencia === null || cuadra
      ? 'Cerrar turno'
      : `Cerrar con ${diferencia < 0 ? 'faltante' : 'sobrante'} de S/ ${soles(Math.abs(diferencia))}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cerrar turno"
      // Clic en el fondo (fuera del diálogo) cancela; mousedown evita cerrar al soltar una selección de texto afuera.
      onMouseDown={(e) => { if (e.target === e.currentTarget && !cerrando) onCancelar(); }}
    >
      <div className="grid h-dvh w-full grid-cols-[minmax(0,1fr)] overflow-y-auto bg-white shadow-[0_30px_60px_-20px_rgba(22,25,34,0.45)] sm:h-[min(640px,calc(100dvh-32px))] sm:max-w-[980px] sm:rounded-[12px] lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">

        {/* ── Izquierda: contar la gaveta ── */}
        <section className="flex min-h-0 flex-col">
          <header className="border-b border-[var(--linea)] px-5 py-4 sm:px-6">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Cerrar turno</h2>
            <p className="text-[13px] text-[var(--pizarra)]">
              Desde las {hora(turno.fechaApertura)} · {duracion(turno.fechaApertura, null, ahora)} · {cobros} {cobros === 1 ? 'cobro' : 'cobros'}
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">Cuenta el efectivo de la gaveta</h3>
              <SelectorModo e={ef} />
            </div>
            {ef.modo === 'total'
              ? <CampoTotal e={ef} id="monto-cierre" etiqueta="Efectivo contado, en soles" error={!!error} errorId="cierre-error" inputRef={inputRef} autoFocus />
              : <ConteoBilletes e={ef} />}
          </div>
        </section>

        {/* ── Derecha: arqueo ── */}
        <section className="flex min-h-0 flex-col border-t border-[var(--linea)] bg-[#FBFAF7] lg:border-t-0 lg:border-l">
          <header className="flex items-center justify-between px-5 pt-4">
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Arqueo</h3>
            <button type="button" onClick={onCancelar} aria-label="Cerrar sin cerrar el turno" className="grid size-8 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[#ECEBE6] hover:text-[var(--ink)]">
              <X className="size-4" strokeWidth={1.9} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-3 pb-4 text-[14px]">
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-[var(--pizarra)]">Ventas · S/ {soles(turno.totalTurno ?? 0)}</p>
              <dl className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
                {CANALES.map((c, i) => (
                  <div key={c.key} className={['px-3 py-2', i % 2 ? 'border-l border-[var(--linea)]' : '', i > 1 ? 'border-t border-[var(--linea)]' : ''].join(' ')}>
                    <dt className="text-[11.5px] text-[var(--pizarra)]">{c.corto}</dt>
                    <dd className="font-semibold text-[var(--ink)] tabular-nums">{soles(canal[c.key as keyof typeof canal])}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <dl className="overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
              <div className="flex justify-between px-3.5 py-2"><dt className="text-[var(--pizarra)]">Fondo de apertura</dt><dd className="tabular-nums">{soles(turno.montoApertura)}</dd></div>
              <div className="flex justify-between border-t border-[var(--linea)] px-3.5 py-2"><dt className="text-[var(--pizarra)]">Cobros en efectivo</dt><dd className="tabular-nums">{soles(canal.efectivo)}</dd></div>
              <div className="flex justify-between border-t border-[var(--linea)] px-3.5 py-2"><dt className="text-[var(--pizarra)]">Gastos</dt><dd className="tabular-nums">{gastos > 0 ? `− ${soles(gastos)}` : '0.00'}</dd></div>
              <div className="flex justify-between border-t border-[var(--linea)] bg-[#FBFAF7] px-3.5 py-2.5 font-semibold"><dt>Debería haber</dt><dd className="tabular-nums">S/ {soles(esperado)}</dd></div>
            </dl>

            <div
              aria-live="polite"
              className={[
                'rounded-[10px] px-4 py-3',
                diferencia === null ? 'border border-dashed border-[var(--linea)] text-[var(--pizarra)]'
                  : cuadra ? 'bg-[var(--ok-tint)] text-[var(--ok)]'
                    : diferencia < 0 ? 'bg-[var(--alerta-tint)] text-[var(--alerta)]'
                      : 'bg-[var(--aviso-tint)] text-[var(--aviso)]',
              ].join(' ')}
            >
              {diferencia === null ? (
                <p className="text-[13.5px]">La diferencia aparece cuando escribas lo contado.</p>
              ) : cuadra ? (
                <p className="flex items-center gap-2 text-[15px] font-semibold"><Check className="size-4" strokeWidth={2} aria-hidden />La caja cuadra</p>
              ) : (
                <>
                  <p className="text-[12.5px] font-medium">{diferencia < 0 ? 'Faltante' : 'Sobrante'}</p>
                  <p className="text-[24px] font-semibold tracking-[-0.01em] tabular-nums">{diferencia < 0 ? '−' : '+'}S/ {soles(Math.abs(diferencia))}</p>
                  <p className="text-[12.5px]">Contaste S/ {soles(contado!)} y se esperaban S/ {soles(esperado)}.</p>
                </>
              )}
            </div>

            {visitas.length > 0 && (
              <p className="flex gap-2 text-[13px] text-[var(--ink)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--aviso)]" strokeWidth={1.9} aria-hidden />
                <span>{visitas.length === 1 ? 'Queda 1 cuenta' : `Quedan ${visitas.length} cuentas`} por cobrar (S/ {soles(porCobrar)}). {visitas.length === 1 ? 'Seguirá abierta' : 'Seguirán abiertas'} para el próximo turno.</span>
              </p>
            )}
            {sinConteoHoy && (
              <p className="flex gap-2 text-[13px] text-[var(--ink)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--aviso)]" strokeWidth={1.9} aria-hidden />
                <span>Hoy no se contó el stock.{esAdmin && <> <a href="/admin/stock" className="font-semibold text-[var(--tinta)] underline">Contar ahora</a></>}</span>
              </p>
            )}
          </div>

          <div className="space-y-2.5 border-t border-[var(--linea)] px-5 py-4">
            {error && <p id="cierre-error" role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error}</p>}
            <button
              type="button"
              onClick={cerrar}
              disabled={cerrando}
              className="h-12 w-full rounded-lg bg-[var(--tinta)] px-3 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
            >
              {etiquetaBoton}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

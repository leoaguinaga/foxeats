'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, TurnoCaja, VisitaResumen, DetalleVisitaCaja, GastoCaja } from '@/lib/api';
import { PlatoCarta } from '@/lib/types';
import { AbrirTurno } from '@/components/caja/AbrirTurno';
import { hora, soles } from '@/components/admin/caja/fechas';
import { PorCobrar } from '@/components/caja/PorCobrar';
import { NuevoPedido } from '@/components/caja/NuevoPedido';
import { CajonTurno } from '@/components/caja/CajonTurno';
import { Cobro } from '@/components/caja/Cobro';
import { CierreTurno } from '@/components/caja/CierreTurno';
import { GastoPanel } from '@/components/caja/GastoPanel';

export default function CajaPage() {
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [visitas, setVisitas] = useState<VisitaResumen[]>([]);
  const [visitaSeleccionada, setVisitaSeleccionada] = useState<VisitaResumen | null>(null);
  const [detalle, setDetalle] = useState<DetalleVisitaCaja | null>(null);
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarGasto, setMostrarGasto] = useState(false);
  const [mostrarCajon, setMostrarCajon] = useState(false);
  const [gastoAEditar, setGastoAEditar] = useState<GastoCaja | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'cobrar' | 'pedido'>('cobrar');
  const [productos, setProductos] = useState<PlatoCarta[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());

  const fetchDatos = useCallback(async () => {
    try {
      const [t, v] = await Promise.all([
        api.caja.turnoActual(),
        api.caja.visitasParaCobrar(),
      ]);
      setTurno(t);
      setVisitas(v);
    } catch {
      setTurno(null);
    } finally {
      setCargando(false);
      setAhora(Date.now());
    }
  }, []);

  // Carga inicial y timer de polling
  useEffect(() => {
    // fetchDatos solo actualiza el estado después de esperar la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDatos();
    const id = setInterval(fetchDatos, 8000);
    api.menu.list().then(setProductos).catch(() => {});
    return () => clearInterval(id);
  }, [fetchDatos]);

  const hayModal = !!visitaSeleccionada || mostrarCierre || mostrarGasto || mostrarCajon;

  // Escribir un número en «Por cobrar» busca esa mesa; Enter abre su cobro.
  const [numero, setNumero] = useState('');
  const [sinCuenta, setSinCuenta] = useState<string | null>(null);
  const timerNumero = useRef<ReturnType<typeof setTimeout> | null>(null);

  function marcarNumero(valor: string) {
    setNumero(valor);
    setSinCuenta(null);
    if (timerNumero.current) clearTimeout(timerNumero.current);
    if (valor) timerNumero.current = setTimeout(() => setNumero(''), 3000);
  }

  // N abre un pedido nuevo; Esc vuelve a «Por cobrar».
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hayModal || e.metaKey || e.ctrlKey || e.altKey) return;
      const escribiendo = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if (vista === 'cobrar' && !escribiendo) {
        if (/^[0-9]$/.test(e.key) && numero.length < 3) { e.preventDefault(); marcarNumero(numero + e.key); return; }
        if (numero && e.key === 'Backspace') { e.preventDefault(); marcarNumero(numero.slice(0, -1)); return; }
        if (numero && e.key === 'Escape') { marcarNumero(''); return; }
        if (numero && e.key === 'Enter') {
          e.preventDefault();
          const v = visitas.find((x) => x.tipo === 'mesa' && String(x.mesaNumero) === numero);
          if (v) { marcarNumero(''); handleSeleccionarVisita(v); }
          else { const n = numero; marcarNumero(''); setSinCuenta(n); setTimeout(() => setSinCuenta(null), 2500); }
          return;
        }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setVista('pedido'); }
      }
      if (e.key === 'Escape' && vista === 'pedido') { (e.target as HTMLElement).blur?.(); setVista('cobrar'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  async function handleSeleccionarVisita(v: VisitaResumen) {
    setVisitaSeleccionada(v);
    setDetalle(null);
    try {
      const d = await api.caja.detalleVisita(v.visitaId);
      setDetalle(d);
    } catch { /* silencioso */ }
  }

  function handleCobrado() {
    setVisitaSeleccionada(null);
    setDetalle(null);
    fetchDatos();
  }

  async function handleEliminarGasto(g: GastoCaja) {
    if (!confirm(`¿Eliminar el gasto «${g.motivo}»? Los S/ ${g.monto} vuelven al efectivo esperado de la gaveta.`)) return;
    try {
      await api.caja.eliminarGasto(g.id);
      toast.success('Gasto eliminado');
      fetchDatos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el gasto');
    }
  }

  if (turno === undefined || cargando) {
    return <div className="flex h-64 items-center justify-center text-[var(--pizarra)]">Cargando…</div>;
  }

  if (!turno) {
    return <AbrirTurno onAbierto={(t) => { setTurno(t); fetchDatos(); }} />;
  }

  const ahoraIso = new Date(ahora).toISOString();

  return (
    // En escritorio la caja ocupa la ventana exacta (bajo la cabecera de 54 px) y cada columna hace su propio scroll.
    <div className="flex min-h-[calc(100dvh-54px)] flex-col lg:h-[calc(100dvh-54px)]">
      {vista === 'cobrar' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[var(--linea)] px-4 py-2.5 md:px-6">
            <p className="text-[13.5px] text-[var(--pizarra)]">
              <span className="mr-1.5 text-[14.5px] font-semibold text-[var(--ink)]">Caja abierta</span>
              desde las {hora(turno.fechaApertura)}
            </p>
            <div className="flex items-center gap-6">
              <Cifra etiqueta="En gaveta" valor={turno.montoCierreTeorico ?? turno.montoApertura} />
              <Cifra etiqueta="Ventas del turno" valor={turno.totalTurno ?? '0.00'} />
              <button
                type="button"
                onClick={() => setMostrarCajon(true)}
                className="h-9 rounded-lg px-2.5 text-[13.5px] font-semibold text-[var(--tinta)] transition-colors hover:bg-[var(--tinta-tint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                Turno y cierre
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 lg:overflow-y-auto">
            <PorCobrar
              visitas={visitas}
              ahora={ahora}
              onSeleccionar={handleSeleccionarVisita}
              onNuevoPedido={() => setVista('pedido')}
              onGasto={() => setMostrarGasto(true)}
            />
          </div>
        </>
      )}

      {vista === 'cobrar' && (numero || sinCuenta) && (
        <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-[14px] text-white shadow-[0_10px_24px_-10px_rgba(22,25,34,0.6)]">
          {sinCuenta
            ? <>La mesa {sinCuenta} no tiene cuenta por cobrar</>
            : visitas.some((x) => x.tipo === 'mesa' && String(x.mesaNumero) === numero)
              ? <>Mesa <b className="tabular-nums">{numero}</b> · <span className="text-white/70">Enter para cobrar</span></>
              : <>Mesa <b className="tabular-nums">{numero}</b> · <span className="text-white/70">sin cuenta abierta</span></>}
        </div>
      )}

      <NuevoPedido
        activo={vista === 'pedido'}
        productos={productos}
        porCobrar={visitas.length}
        onVolver={() => setVista('cobrar')}
        onCreado={(cuenta) => { fetchDatos(); if (cuenta) handleSeleccionarVisita(cuenta); }}
      />

      {visitaSeleccionada && (
        <Cobro
          visita={visitaSeleccionada}
          detalle={detalle}
          productos={productos}
          onCobrado={handleCobrado}
          onCerrar={() => setVisitaSeleccionada(null)}
          onRefreshDetalle={async () => {
            try {
              const d = await api.caja.detalleVisita(visitaSeleccionada.visitaId);
              setDetalle(d);
            } catch {}
            fetchDatos();
          }}
        />
      )}

      <CajonTurno
        open={mostrarCajon}
        turno={turno}
        ahora={ahoraIso}
        onClose={() => setMostrarCajon(false)}
        onGasto={() => { setMostrarCajon(false); setMostrarGasto(true); }}
        onEditarGasto={(g) => { setMostrarCajon(false); setGastoAEditar(g); setMostrarGasto(true); }}
        onEliminarGasto={handleEliminarGasto}
        onCerrarTurno={() => { setMostrarCajon(false); setMostrarCierre(true); }}
      />

      {mostrarCierre && (
        <CierreTurno
          turno={turno}
          visitas={visitas}
          ahora={ahoraIso}
          onCerrado={() => { setMostrarCierre(false); setTurno(null); setVista('cobrar'); fetchDatos(); }}
          onCancelar={() => setMostrarCierre(false)}
        />
      )}

      {mostrarGasto && (
        <GastoPanel
          gasto={gastoAEditar}
          enGaveta={parseFloat(turno.montoCierreTeorico ?? turno.montoApertura)}
          onGuardado={() => {
            setMostrarGasto(false);
            setGastoAEditar(null);
            fetchDatos();
          }}
          onCancelar={() => {
            setMostrarGasto(false);
            setGastoAEditar(null);
          }}
        />
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--pizarra)]">{etiqueta}</p>
      <p className="text-[19px] leading-tight font-semibold tracking-[-0.01em] text-[var(--ink)] tabular-nums">
        <span className="mr-0.5 text-[12px] font-semibold text-[var(--pizarra)]">S/</span>{soles(valor)}
      </p>
    </div>
  );
}

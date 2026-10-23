'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { PlatoCarta, PromocionVigente, Visita } from '@/lib/types';
import { precioConPromo } from '@/lib/promociones';
import { soles } from '@/components/admin/caja/fechas';
import { Catalogo } from '@/components/caja/Catalogo';
import { PromosAhora } from '@/components/mesero/PromosAhora';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Cabecera, tituloVisita } from '@/components/mesero/mesa/Cabecera';
import { RondaNueva, type LineaRonda } from '@/components/mesero/mesa/RondaNueva';
import { EnLaMesa } from '@/components/mesero/mesa/EnLaMesa';
import { CancelarRonda } from '@/components/mesero/mesa/CancelarRonda';
import { RONDA_VACIA, guardarBorrador, leerBorrador, type BorradorRonda } from '@/components/mesero/mesa/borrador';

type Pestana = 'ronda' | 'mesa';

/**
 * Mesa del mesero: a la izquierda la carta (tocar el plato lo suma), a la
 * derecha la ronda que se va a enviar o lo que la mesa ya pidió.
 */
export default function MesaPage() {
  const { visitaId } = useParams<{ visitaId: string }>();
  const router = useRouter();

  const [visita, setVisita] = useState<Visita | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [menu, setMenu] = useState<PlatoCarta[]>([]);
  const [promos, setPromos] = useState<PromocionVigente[]>([]);
  const [ronda, setRonda] = useState<BorradorRonda>(RONDA_VACIA);
  const borradorLeido = useRef(false);
  const [pestana, setPestana] = useState<Pestana>('ronda');
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [porCancelar, setPorCancelar] = useState<string | null>(null);
  const [confirmarLiberar, setConfirmarLiberar] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const fetchVisita = useCallback(async () => {
    try {
      const data = await api.visitas.get(visitaId);
      setVisita(data);
      // La ronda guardada se lee una vez, cuando la visita existe.
      if (!borradorLeido.current) {
        borradorLeido.current = true;
        setRonda(leerBorrador(visitaId));
      }
    } catch (err) {
      if (err instanceof Error && /no encontrada/i.test(err.message)) setNoEncontrada(true);
      // el resto, silencioso en el sondeo
    }
  }, [visitaId]);

  useEffect(() => {
    const cargarMenu = () => api.menu.list().then(setMenu).catch(() => {});
    const cargarPromos = () => api.promociones.vigentes().then(setPromos).catch(() => {});
    cargarMenu();
    cargarPromos();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    fetchVisita();
    // «Quedan N» cambia con las ventas de otras mesas.
    const idMenu = setInterval(cargarMenu, 10_000);
    const idVisita = setInterval(fetchVisita, 5_000);
    const idPromos = setInterval(cargarPromos, 60_000);
    const idReloj = setInterval(() => setAhora(Date.now()), 30_000);
    return () => { clearInterval(idMenu); clearInterval(idVisita); clearInterval(idPromos); clearInterval(idReloj); };
  }, [fetchVisita]);

  useEffect(() => {
    if (borradorLeido.current) guardarBorrador(visitaId, ronda);
  }, [visitaId, ronda]);

  // ── Precios, promos y stock ──────────────────────────────
  const platoMap = useMemo(() => new Map(menu.map((p) => [p.id, p])), [menu]);
  // Si dos promos cubren el mismo plato gana la primera, igual que en el backend.
  const promoPorPlato = useMemo(() => {
    const m = new Map<string, PromocionVigente>();
    for (const pr of promos) for (const id of pr.platoCartaIds) if (!m.has(id)) m.set(id, pr);
    return m;
  }, [promos]);
  const precio = useCallback(
    (p: PlatoCarta) => precioConPromo(parseFloat(p.precio), promoPorPlato.get(p.id)),
    [promoPorPlato],
  );

  const lineas: LineaRonda[] = ronda.lineas.flatMap((l) => {
    const plato = platoMap.get(l.platoId);
    return plato ? [{ plato, cantidad: l.cantidad, notas: l.notas }] : [];
  });
  const cantidades = new Map(lineas.map((l) => [l.plato.id, l.cantidad]));
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const totalRonda = lineas.reduce((s, l) => s + precio(l.plato) * l.cantidad, 0);

  // Cuántas unidades se pueden pedir de un plato: lo que queda del insumo,
  // descontando lo que ya llevan en esta ronda otros platos del mismo insumo.
  function maximo(plato: PlatoCarta): number {
    if (plato.insumoId === null || plato.stockActual === null || !plato.cantidadConsumida) return 50;
    let otros = 0;
    for (const l of lineas) {
      if (l.plato.id !== plato.id && l.plato.insumoId === plato.insumoId) otros += l.cantidad * (l.plato.cantidadConsumida ?? 0);
    }
    return Math.max(0, Math.floor((plato.stockActual - otros) / plato.cantidadConsumida));
  }

  // ── Editar la ronda ──────────────────────────────────────
  function editar(fn: (b: BorradorRonda) => BorradorRonda) {
    setErrorEnvio(null);
    setRonda(fn);
  }

  function agregar(plato: PlatoCarta) {
    const actual = cantidades.get(plato.id) ?? 0;
    const max = maximo(plato);
    if (actual >= max) {
      toast.error(max === 0 ? `${plato.nombre}: no queda` : `${plato.nombre}: solo ${max === 1 ? 'queda 1' : `quedan ${max}`}`);
      return;
    }
    setPestana('ronda');
    editar((b) => ({
      ...b,
      lineas: b.lineas.some((l) => l.platoId === plato.id)
        ? b.lineas.map((l) => (l.platoId === plato.id ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...b.lineas, { platoId: plato.id, cantidad: 1, notas: '' }],
    }));
  }

  const cambiar = (platoId: string, diff: number) =>
    editar((b) => ({
      ...b,
      lineas: b.lineas.flatMap((l) => {
        if (l.platoId !== platoId) return [l];
        const cantidad = l.cantidad + diff;
        return cantidad > 0 ? [{ ...l, cantidad }] : [];
      }),
    }));

  const anotar = (platoId: string, notas: string) =>
    editar((b) => ({ ...b, lineas: b.lineas.map((l) => (l.platoId === platoId ? { ...l, notas } : l)) }));

  const vaciar = useCallback(() => {
    const previa = ronda;
    if (previa.lineas.length === 0) return;
    setRonda(RONDA_VACIA);
    toast((t) => (
        <span className="flex items-center gap-3">
          Ronda vaciada
          <button
            type="button"
            onClick={() => { setRonda(previa); toast.dismiss(t.id); }}
            className="font-semibold text-[var(--aji)] hover:underline"
          >
            Deshacer
          </button>
        </span>
      ), { duration: 5000 });
  }, [ronda]);

  const enviar = useCallback(async () => {
    if (enviando || !visita) return;
    const items = ronda.lineas.filter((l) => platoMap.has(l.platoId));
    if (!items.length) return;
    const nombre = ronda.nombre.trim();
    if (ronda.paraLlevar && !nombre) { setErrorEnvio('Escribe a nombre de quién va la ronda para llevar.'); return; }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await api.visitas.crearPedido(
        visitaId,
        items.map((l) => ({ platoCartaId: l.platoId, cantidad: l.cantidad, notas: l.notas.trim() || undefined })),
        ronda.paraLlevar ? { paraLlevar: true, nombreClienteLlevar: nombre } : {},
      );
      toast.success('Ronda enviada a cocina');
      setRonda(RONDA_VACIA);
      setHojaAbierta(false);
      fetchVisita();
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : 'No se pudo enviar la ronda. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }, [enviando, visita, ronda, platoMap, visitaId, fetchVisita]);

  // ⌘/Ctrl + Enter envía; Esc baja la hoja o, sin nada abierto, vacía la ronda.
  const hayDialogo = !!porCancelar || confirmarLiberar;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hayDialogo) return;
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(); return; }
      if (e.key !== 'Escape') return;
      if (hojaAbierta) { setHojaAbierta(false); return; }
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (pestana === 'ronda') vaciar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hayDialogo, hojaAbierta, pestana, enviar, vaciar]);

  // ── Lo que ya pidió la mesa ──────────────────────────────
  async function marcarEntregada(pedidoId: string) {
    setOcupado(pedidoId);
    try {
      await api.pedidos.cambiarEstado(pedidoId, 'entregado');
      fetchVisita();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo marcar la ronda');
    } finally {
      setOcupado(null);
    }
  }

  async function quitarItem(itemId: string): Promise<boolean> {
    setOcupado(itemId);
    try {
      await api.pedidos.cancelarItem(itemId);
      await fetchVisita();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo quitar el plato');
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function cancelarRonda(motivo: string) {
    if (!porCancelar) return;
    setOcupado(porCancelar);
    try {
      await api.pedidos.cambiarEstado(porCancelar, 'cancelado', { motivoCancelacion: motivo });
      toast.success('Ronda cancelada');
      setPorCancelar(null);
      fetchVisita();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cancelar la ronda');
    } finally {
      setOcupado(null);
    }
  }

  async function precuenta() {
    if (!visita) return;
    setImprimiendo(true);
    try {
      await api.visitas.imprimirCuenta(visita.id);
      toast.success('Precuenta enviada a la ticketera');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir la precuenta');
    } finally {
      setImprimiendo(false);
    }
  }

  async function liberar() {
    if (!visita) return;
    setLiberando(true);
    try {
      await api.visitas.cerrar(visita.id);
      guardarBorrador(visitaId, RONDA_VACIA);
      toast.success(visita.tipo === 'mesa' && !visita.paraLlevar ? 'Mesa liberada' : 'Pedido cerrado');
      router.push('/mesero');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo liberar');
      setLiberando(false);
      setConfirmarLiberar(false);
    }
  }

  // ── Render ───────────────────────────────────────────────
  if (noEncontrada || visita?.estado === 'cerrada') {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <p className="text-[16px] font-semibold text-[var(--ink)]">{noEncontrada ? 'No encontramos esta mesa' : 'Esta cuenta ya se cerró'}</p>
        <p className="mt-1 text-[14px] text-[var(--pizarra)]">{noEncontrada ? 'Puede que se haya cerrado desde caja.' : 'Caja la cobró o la liberó.'}</p>
        <Link href="/mesero" className="mt-5 inline-flex h-10 items-center rounded-lg bg-[var(--tinta)] px-4 text-[14px] font-semibold text-white hover:bg-[var(--tinta-hover)]">
          Volver al salón
        </Link>
      </div>
    );
  }

  if (!visita) {
    return <div className="flex h-64 items-center justify-center text-[14px] text-[var(--pizarra)]">Cargando mesa…</div>;
  }

  const consumo = visita.pedidos
    .filter((p) => p.estado !== 'cancelado')
    .reduce((s, p) => s + p.items.filter((i) => i.estado !== 'cancelado').reduce((t, i) => t + parseFloat(i.precioUnitarioCongelado) * i.cantidad, 0), 0);
  const rondasEnMesa = visita.pedidos.filter((p) => p.estado !== 'cancelado').length;
  const numeroPorCancelar = porCancelar
    ? [...visita.pedidos].sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime()).findIndex((p) => p.id === porCancelar) + 1
    : 0;

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <Cabecera
        visita={visita}
        ahora={ahora}
        consumo={consumo}
        imprimiendo={imprimiendo}
        onPrecuenta={precuenta}
        onLiberar={() => setConfirmarLiberar(true)}
      />

      {/* Bajo 1024 px: «Pedir | En la mesa» reemplaza la segunda columna. */}
      <div className="border-b border-[var(--linea)] bg-white px-4 py-2 lg:hidden">
        <Pestanas pestana={pestana} onCambiar={setPestana} rondas={rondasEnMesa} etiquetaRonda="Pedir" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-label="Carta"
          className={[
            'min-h-0 overflow-y-auto px-4 pt-4 md:px-6',
            unidades > 0 ? 'max-lg:pb-24 lg:pb-4' : 'pb-4',
            pestana === 'mesa' ? 'max-lg:hidden' : '',
          ].join(' ')}
        >
          <div className="mb-3 empty:hidden"><PromosAhora promos={promos} /></div>
          <Catalogo
            productos={menu}
            cantidades={cantidades}
            onAgregar={agregar}
            promos={promoPorPlato}
            cargarMasPedidos={api.menu.masPedidosSalon}
            rejilla="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"
          />
        </section>

        {hojaAbierta && (
          <button type="button" aria-label="Bajar la ronda" onClick={() => setHojaAbierta(false)} className="fixed inset-0 z-30 bg-[var(--ink)]/35 animate-in fade-in duration-150 lg:hidden" />
        )}

        <aside
          aria-label={pestana === 'ronda' ? 'Ronda nueva' : 'En la mesa'}
          className={[
            'flex min-h-0 flex-col bg-white lg:border-l lg:border-[var(--linea)]',
            pestana === 'mesa'
              ? 'max-lg:bg-[var(--piedra)]'
              : [
                'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[88dvh] max-lg:rounded-t-[14px] max-lg:shadow-[0_-18px_40px_-20px_rgba(22,25,34,0.45)] max-lg:transition-[transform,visibility] max-lg:duration-300 max-lg:ease-[cubic-bezier(0.22,1,0.36,1)]',
                hojaAbierta ? 'max-lg:translate-y-0' : 'max-lg:invisible max-lg:translate-y-full',
              ].join(' '),
          ].join(' ')}
        >
          <div className="border-b border-[var(--linea)] px-4 py-2.5 max-lg:hidden">
            <Pestanas pestana={pestana} onCambiar={setPestana} rondas={rondasEnMesa} etiquetaRonda="Ronda nueva" unidades={unidades} />
          </div>

          {pestana === 'ronda' ? (
            <RondaNueva
              titulo={tituloVisita(visita)}
              lineas={lineas}
              precio={precio}
              promos={promoPorPlato}
              maximo={maximo}
              onCambiar={cambiar}
              onAnotar={anotar}
              mostrarLlevar={!visita.paraLlevar && visita.tipo === 'mesa'}
              paraLlevar={ronda.paraLlevar}
              nombre={ronda.nombre}
              onParaLlevar={(v) => editar((b) => ({ ...b, paraLlevar: v, nombre: v ? b.nombre : '' }))}
              onNombre={(nombre) => editar((b) => ({ ...b, nombre }))}
              enviando={enviando}
              error={errorEnvio}
              onEnviar={enviar}
              onCerrarHoja={() => setHojaAbierta(false)}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto lg:bg-[#FBFAF7]">
              <EnLaMesa
                pedidos={visita.pedidos}
                platoMap={platoMap}
                ahora={ahora}
                ocupado={ocupado}
                onEntregada={marcarEntregada}
                onQuitarItem={quitarItem}
                onCancelarRonda={setPorCancelar}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Bajo 1024 px esta barra sube la ronda como hoja. */}
      {pestana === 'ronda' && unidades > 0 && !hojaAbierta && (
        <button
          type="button"
          onClick={() => setHojaAbierta(true)}
          className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3 rounded-[10px] bg-[var(--tinta)] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(22,25,34,0.5)] lg:hidden"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--aji)] px-1.5 text-[12.5px] font-bold text-[var(--ink)] tabular-nums">{unidades}</span>
            Ver ronda
          </span>
          <span className="tabular-nums">S/ {soles(totalRonda)}</span>
        </button>
      )}

      <CancelarRonda
        open={!!porCancelar}
        ronda={`Ronda ${numeroPorCancelar || ''}`.trim()}
        guardando={!!porCancelar && ocupado === porCancelar}
        onConfirmar={cancelarRonda}
        onCerrar={() => setPorCancelar(null)}
      />

      <ConfirmDialog
        open={confirmarLiberar}
        title={visita.tipo === 'mesa' && !visita.paraLlevar ? `Liberar ${tituloVisita(visita)}` : 'Cerrar pedido'}
        description={
          visita.tipo === 'mesa' && !visita.paraLlevar
            ? 'La mesa queda libre para recibir clientes nuevos.'
            : 'El pedido se cierra y ya no se le puede agregar nada.'
        }
        confirmLabel={visita.tipo === 'mesa' && !visita.paraLlevar ? 'Liberar mesa' : 'Cerrar pedido'}
        loading={liberando}
        onConfirm={liberar}
        onCancel={() => setConfirmarLiberar(false)}
      />
    </div>
  );
}

function Pestanas({ pestana, onCambiar, rondas, etiquetaRonda, unidades = 0 }: {
  pestana: Pestana;
  onCambiar: (p: Pestana) => void;
  rondas: number;
  etiquetaRonda: string;
  unidades?: number;
}) {
  const opciones: Array<[Pestana, string, number]> = [['ronda', etiquetaRonda, unidades], ['mesa', 'En la mesa', rondas]];
  return (
    <div role="tablist" className="grid grid-cols-2 rounded-lg bg-[#ECEBE6] p-0.5 text-[13.5px]">
      {opciones.map(([k, l, n]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={pestana === k}
          onClick={() => onCambiar(k)}
          className={[
            'inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
            pestana === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
          ].join(' ')}
        >
          {l}
          {n > 0 && (
            <span className={['grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums', k === 'ronda' ? 'bg-[var(--aji)] text-[var(--ink)]' : 'bg-[var(--tinta)] text-white'].join(' ')}>
              {n}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Bike, ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { Mesa, Zona } from '@/lib/types';
import { MesaCard } from '@/components/mesero/MesaCard';
import { PlanoServicio } from '@/components/mesero/salon/PlanoServicio';
import { AhoraLinea, AhoraPanel } from '@/components/mesero/salon/Ahora';
import { HojaInferior } from '@/components/mesero/salon/HojaInferior';
import { duracion } from '@/components/mesero/salon/servicio';
import { etiquetaCorta, etiquetaMesa } from '@/lib/mesas';

const INTERVALO_MS = 5000;

interface PedidoExterno {
  id: string;
  tipo: 'llevar' | 'delivery';
  nombreCliente: string | null;
  telefonoCliente: string | null;
  direccionDelivery: string | null;
  costoEnvio: string | null;
  fechaApertura: string;
  total: string;
  cantidadItems: number;
}

export default function MeseroHome() {
  const router = useRouter();
  const { data: sesion } = useSession();
  const yo = sesion?.user?.id ?? null;

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<number | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const [abriendo, setAbriendo] = useState(false);
  const [mesaPorAbrir, setMesaPorAbrir] = useState<Mesa | null>(null);
  const [llevarAbierto, setLlevarAbierto] = useState(false);
  const [abriendoLlevar, setAbriendoLlevar] = useState(false);
  const [tabActivo, setTabActivo] = useState<'salon' | 'llevar_delivery'>('salon');
  const [pedidosExternos, setPedidosExternos] = useState<PedidoExterno[]>([]);

  const fetchDatos = useCallback(async () => {
    const [m, z, ext] = await Promise.allSettled([api.mesas.list(), api.zonas.list(), api.visitas.activeLlevarDelivery()]);
    // Excluir la mesa virtual 0 (para llevar) de la vista de mesas
    if (m.status === 'fulfilled') setMesas(m.value.filter((x) => x.numero !== 0));
    if (z.status === 'fulfilled') setZonas(z.value);
    if (ext.status === 'fulfilled') setPedidosExternos(ext.value);
    const fallo = m.status === 'rejected';
    setSinConexion(fallo);
    if (!fallo) setActualizado(Date.now());
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    fetchDatos();
    const id = setInterval(fetchDatos, INTERVALO_MS);
    return () => clearInterval(id);
  }, [fetchDatos]);

  // Reloj para «hace N s» y el tiempo en mesa.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nombre = useCallback((m: Mesa) => etiquetaMesa(m, mesas), [mesas]);

  async function irAMesa(mesa: Mesa) {
    if (mesa.visita) {
      router.push(`/mesero/mesa/${mesa.visita.id}`);
      return;
    }
    try {
      const visita = await api.mesas.visitaActiva(mesa.id);
      router.push(`/mesero/mesa/${visita.id}`);
    } catch {
      toast.error('No se encontró la visita activa');
    }
  }

  function handleMesaClick(mesa: Mesa) {
    if (mesa.estado === 'ocupada') irAMesa(mesa);
    else setMesaPorAbrir(mesa);
  }

  async function confirmarAbrirMesa() {
    if (!mesaPorAbrir) return;
    const mesa = mesaPorAbrir;
    setAbriendo(true);
    try {
      const visita = await api.mesas.abrir(mesa.id);
      toast.success(`${nombre(mesa)} abierta`);
      setMesaPorAbrir(null);
      router.push(`/mesero/mesa/${visita.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la mesa');
    } finally {
      setAbriendo(false);
    }
  }

  async function entregar(mesa: Mesa) {
    const rondas = mesa.visita?.rondas.filter((r) => r.estado === 'listo') ?? [];
    try {
      await Promise.all(rondas.map((r) => api.pedidos.cambiarEstado(r.id, 'entregado')));
      toast.success(`${nombre(mesa)}: platos entregados`);
      await fetchDatos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo marcar como entregado');
    }
  }

  async function confirmarParaLlevar(nombreCliente: string) {
    setAbriendoLlevar(true);
    try {
      const visita = await api.visitas.abrirParaLlevar({ nombreCliente });
      setLlevarAbierto(false);
      toast.success('Pedido para llevar abierto');
      router.push(`/mesero/mesa/${visita.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir el pedido para llevar');
    } finally {
      setAbriendoLlevar(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center text-[14px] text-[var(--pizarra)]">
        Cargando el salón…
      </div>
    );
  }

  // Zonas: cada mesa pertenece a una; sin zona válida cae en la primera.
  const zona = zonas.find((z) => z.id === zonaActiva) ?? zonas[0] ?? null;
  const zonaDe = (m: Mesa) => (m.zonaId && zonas.some((z) => z.id === m.zonaId) ? m.zonaId : zonas[0]?.id ?? null);
  const mesasZona = zona ? mesas.filter((m) => zonaDe(m) === zona.id) : mesas;

  // Si la zona usa plano y tiene mesas ubicadas, se dibuja el plano (con
  // referencias como Entrada o Barra). Si no, grid por número.
  const conPosicion = mesasZona.filter((m) => m.filaPosicion !== null && m.colPosicion !== null);
  const sinPosicion = mesasZona
    .filter((m) => m.filaPosicion === null || m.colPosicion === null)
    .sort((a, b) => a.numero - b.numero);
  const usarPlano = (zona?.modo ?? 'plano') === 'plano' && conPosicion.length > 0;
  const porNumero = usarPlano ? sinPosicion : [...mesasZona].sort((a, b) => a.numero - b.numero);

  const mias = mesas.filter((m) => m.estado === 'ocupada' && m.visita && m.visita.abiertaPor.id === yo);

  const tarjeta = (mesa: Mesa, compacto = false) => (
    <MesaCard
      mesa={mesa}
      etiqueta={mesa.tipo === 'barra' ? etiquetaCorta(mesa, mesas) : undefined}
      mia={!!mesa.visita && mesa.visita.abiertaPor.id === yo}
      ahora={ahora}
      compacto={compacto}
      ocupado={abriendo && mesaPorAbrir?.id === mesa.id}
      onClick={() => handleMesaClick(mesa)}
    />
  );

  const propsAhora = { mias, ahora, actualizado, sinConexion, nombre, onIr: irAMesa, onEntregar: entregar };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 px-4 py-4 md:px-6 md:py-5">
      {/* Salón | Llevar y delivery · Nuevo para llevar */}
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-[10px] border border-[var(--linea)] bg-white p-[3px]">
          {([
            ['salon', 'Salón'],
            ['llevar_delivery', 'Llevar y delivery'],
          ] as const).map(([id, label]) => {
            const on = tabActivo === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => setTabActivo(id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors sm:px-3.5',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
                  on ? 'bg-[var(--tinta)] text-white' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
                ].join(' ')}
              >
                {label}
                {id === 'llevar_delivery' && pedidosExternos.length > 0 && (
                  <span className="rounded-full bg-[var(--aji)] px-1.5 text-[11.5px] leading-[18px] font-bold text-[var(--ink)] tabular-nums">
                    {pedidosExternos.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLlevarAbierto(true)}
          disabled={abriendoLlevar}
          aria-label="Nuevo para llevar"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] border border-[var(--linea)] bg-white px-2.5 text-[13.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--piedra)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] disabled:opacity-50 sm:px-3"
        >
          <ShoppingBag className="size-4" strokeWidth={1.9} aria-hidden />
          <span className="hidden sm:inline">Nuevo para llevar</span>
        </button>
      </div>

      {tabActivo === 'salon' ? (
        <>
          <div className="flex items-center justify-between gap-3">
            {zonas.length > 1 ? (
              <div role="tablist" aria-label="Zonas" className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
                {zonas.map((z) => {
                  const on = z.id === zona?.id;
                  const libres = mesas.filter((m) => zonaDe(m) === z.id && m.estado === 'libre').length;
                  return (
                    <button
                      key={z.id}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setZonaActiva(z.id)}
                      className={[
                        'shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                        on ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:bg-[var(--piedra)]',
                      ].join(' ')}
                    >
                      {z.nombre}
                      <span className={on ? 'ml-1.5 font-medium text-white/70' : 'ml-1.5 font-medium text-[var(--pizarra)]'}>
                        {libres} libre{libres !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13.5px] text-[var(--pizarra)]">
                {mesasZona.filter((m) => m.estado === 'libre').length} libres · {mesasZona.filter((m) => m.estado === 'ocupada').length} ocupadas
              </p>
            )}
            <Leyenda />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <div className="lg:hidden">
                <AhoraLinea {...propsAhora} />
              </div>

              {mesasZona.length === 0 ? (
                <div className="rounded-xl border border-[var(--linea)] bg-white px-6 py-12 text-center">
                  <p className="text-[15px] font-semibold text-[var(--ink)]">Esta zona no tiene mesas</p>
                  <p className="mt-1 text-[13.5px] text-[var(--pizarra)]">Administración las agrega desde Salón.</p>
                </div>
              ) : (
                <>
                  {usarPlano && (
                    <div className="rounded-xl border border-[var(--linea)] bg-[#FBFAF7] [background-image:radial-gradient(#E4E2DA_1px,transparent_1.2px)] [background-size:16px_16px] p-3 sm:p-5">
                      <PlanoServicio mesas={conPosicion} referencias={zona?.referencias ?? []} render={tarjeta} />
                    </div>
                  )}

                  {porNumero.length > 0 && (
                    <div className="space-y-2">
                      {usarPlano && <h3 className="text-[13px] font-semibold text-[var(--pizarra)]">Sin ubicar en el plano</h3>}
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
                        {porNumero.map((mesa) => (
                          <div key={mesa.id} className="aspect-square">{tarjeta(mesa)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <aside className="hidden lg:block">
              <AhoraPanel {...propsAhora} />
            </aside>
          </div>
        </>
      ) : (
        <ListaExternos pedidos={pedidosExternos} ahora={ahora} onAbrir={(id) => router.push(`/mesero/mesa/${id}`)} onNuevo={() => setLlevarAbierto(true)} />
      )}

      <HojaInferior
        open={!!mesaPorAbrir}
        onClose={() => setMesaPorAbrir(null)}
        bloqueada={abriendo}
        titulo={mesaPorAbrir ? `Abrir ${nombre(mesaPorAbrir)}` : 'Abrir mesa'}
      >
        {mesaPorAbrir && (
          <AbrirMesa
            mesa={mesaPorAbrir}
            nombre={nombre(mesaPorAbrir)}
            zona={zonas.length > 1 ? zonas.find((z) => z.id === zonaDe(mesaPorAbrir))?.nombre ?? null : null}
            abriendo={abriendo}
            onConfirmar={confirmarAbrirMesa}
            onCancelar={() => setMesaPorAbrir(null)}
          />
        )}
      </HojaInferior>

      <HojaInferior open={llevarAbierto} onClose={() => setLlevarAbierto(false)} bloqueada={abriendoLlevar} titulo="Nuevo pedido para llevar">
        {llevarAbierto && (
          <NombreCliente loading={abriendoLlevar} onConfirm={confirmarParaLlevar} onCancel={() => setLlevarAbierto(false)} />
        )}
      </HojaInferior>
    </div>
  );
}

function Leyenda() {
  return (
    <div aria-hidden className="hidden shrink-0 items-center gap-4 text-[12.5px] text-[var(--pizarra)] md:flex">
      <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#C9CBD6] bg-white" />Libre</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] bg-[var(--tinta)]" />Tuya</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#D5D9E6] bg-[var(--tinta-tint)]" />De otro mesero</span>
    </div>
  );
}

function AbrirMesa({
  mesa, nombre, zona, abriendo, onConfirmar, onCancelar,
}: {
  mesa: Mesa; nombre: string; zona: string | null; abriendo: boolean; onConfirmar: () => void; onCancelar: () => void;
}) {
  const detalle = [
    zona,
    mesa.tipo === 'barra' ? `Nº ${mesa.numero}` : null,
    mesa.capacidad ? `para ${mesa.capacidad} persona${mesa.capacidad !== 1 ? 's' : ''}` : null,
    'libre',
  ].filter(Boolean).join(' · ');

  return (
    <>
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{nombre}</h2>
      <p className="mt-0.5 mb-4 text-[13.5px] text-[var(--pizarra)]">{detalle}</p>
      <button
        type="button"
        autoFocus
        onClick={onConfirmar}
        disabled={abriendo}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tinta)] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)] disabled:opacity-60"
      >
        <Plus className="size-4" strokeWidth={2.2} aria-hidden />
        {abriendo ? 'Abriendo…' : `Abrir ${nombre.toLowerCase().startsWith('mesa') ? `mesa ${mesa.numero}` : nombre}`}
      </button>
      <button type="button" onClick={onCancelar} disabled={abriendo} className="mt-1 w-full py-2.5 text-[14px] font-medium text-[var(--pizarra)] hover:text-[var(--ink)] disabled:opacity-50">
        Cancelar
      </button>
    </>
  );
}

function NombreCliente({ loading, onConfirm, onCancel }: { loading: boolean; onConfirm: (nombre: string) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState('');
  const limpio = nombre.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (limpio && !loading) onConfirm(limpio);
      }}
    >
      <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Nuevo pedido para llevar</h2>
      <p className="mt-0.5 mb-4 text-[13.5px] text-[var(--pizarra)]">Con el nombre se identifica el pedido en cocina y en caja.</p>
      <label htmlFor="nombre-llevar" className="mb-1.5 block text-[13px] font-semibold text-[var(--ink)]">Nombre del cliente</label>
      <input
        id="nombre-llevar"
        type="text"
        placeholder="Ej.: Juan Pérez"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        disabled={loading}
        autoFocus
        autoComplete="off"
        className="h-11 w-full rounded-[10px] border border-[var(--linea)] bg-white px-3 text-[15px] text-[var(--ink)] placeholder:text-[#8A8D98] focus:border-[var(--tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--tinta)]/20"
      />
      <button
        type="submit"
        disabled={!limpio || loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tinta)] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)] disabled:opacity-40"
      >
        {loading ? 'Abriendo…' : 'Iniciar pedido'}
      </button>
      <button type="button" onClick={onCancel} disabled={loading} className="mt-1 w-full py-2.5 text-[14px] font-medium text-[var(--pizarra)] hover:text-[var(--ink)] disabled:opacity-50">
        Cancelar
      </button>
    </form>
  );
}

function ListaExternos({
  pedidos, ahora, onAbrir, onNuevo,
}: { pedidos: PedidoExterno[]; ahora: number; onAbrir: (id: string) => void; onNuevo: () => void }) {
  if (pedidos.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--linea)] bg-white px-6 py-12 text-center">
        <p className="text-[15px] font-semibold text-[var(--ink)]">No hay pedidos para llevar ni delivery abiertos</p>
        <p className="mx-auto mt-1 max-w-[44ch] text-[13.5px] text-[var(--pizarra)]">Cuando se abra uno aparecerá aquí, del más antiguo al más nuevo.</p>
        <button
          type="button"
          onClick={onNuevo}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-[9px] bg-[var(--tinta)] px-3.5 text-[13.5px] font-semibold text-white hover:bg-[var(--tinta-hover)]"
        >
          <ShoppingBag className="size-4" strokeWidth={1.9} aria-hidden />Nuevo para llevar
        </button>
      </div>
    );
  }

  return (
    <ul className="mx-auto max-w-[860px] divide-y divide-[var(--linea)] overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
      {[...pedidos]
        .sort((a, b) => new Date(a.fechaApertura).getTime() - new Date(b.fechaApertura).getTime())
        .map((p) => {
          const min = Math.max(0, Math.floor((ahora - new Date(p.fechaApertura).getTime()) / 60000));
          const delivery = p.tipo === 'delivery';
          const detalle = [
            delivery ? 'Delivery' : 'Para llevar',
            `${p.cantidadItems} producto${p.cantidadItems !== 1 ? 's' : ''}`,
            delivery ? p.direccionDelivery : null,
          ].filter(Boolean).join(' · ');
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onAbrir(p.id)}
                className="group grid w-full grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--piedra)]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                <span className="grid size-11 place-items-center rounded-[9px] bg-[var(--tinta-tint)] text-[var(--tinta)]">
                  {delivery ? <Bike className="size-5" strokeWidth={1.9} aria-hidden /> : <ShoppingBag className="size-5" strokeWidth={1.9} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-[var(--ink)]">{p.nombreCliente ?? 'Cliente sin nombre'}</span>
                  <span className="block truncate text-[13px] text-[var(--pizarra)]">{detalle}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold text-[var(--ink)] tabular-nums">S/ {Number(p.total).toFixed(2)}</span>
                  <span className="block text-[12.5px] text-[var(--pizarra)] tabular-nums">hace {duracion(min)}</span>
                </span>
                <ChevronRight className="size-4 text-[#9A9DA8] transition-transform group-hover:translate-x-0.5" strokeWidth={1.9} aria-hidden />
              </button>
            </li>
          );
        })}
    </ul>
  );
}

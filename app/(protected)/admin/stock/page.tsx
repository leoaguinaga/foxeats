'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronRight, ClipboardCheck, Link2Off, Plus, Search, Truck } from 'lucide-react';
import { api, type InsumoStock, type UltimoConteo } from '@/lib/api';
import { botonCls, botonFantasmaCls, botonPrimarioCls } from '@/components/admin/salon/controles';
import { PanelInsumo } from '@/components/admin/stock/PanelInsumo';
import { FormInsumo } from '@/components/admin/stock/FormInsumo';
import { RecibirCompra } from '@/components/admin/stock/RecibirCompra';
import { ContarStock } from '@/components/admin/stock/ContarStock';
import {
  cantidadAlterna, cantidadTexto, esFraccion, estadoStock, etaAgota, fechaConDia, plural,
} from '@/components/admin/stock/stock';

type Filtro = 'todo' | 'rep' | 'agot' | 'sin';
type Modo = { t: 'lista' } | { t: 'compra'; foco?: string } | { t: 'conteo' };

export default function AdminStockPage() {
  const [insumos, setInsumos] = useState<InsumoStock[] | null>(null);
  const [conteo, setConteo] = useState<UltimoConteo | null | undefined>(undefined);
  const [modo, setModo] = useState<Modo>({ t: 'lista' });
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<InsumoStock | null>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const [lista, ult] = await Promise.all([api.admin.getStock(), api.admin.ultimoConteo()]);
      setInsumos(lista);
      setConteo(ult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el stock');
      setInsumos((v) => v ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    cargar();
    const id = setInterval(() => { if (modo.t === 'lista') cargar(); }, 15000);
    return () => clearInterval(id);
  }, [cargar, modo.t]);

  // «/» enfoca el buscador, como en el resto de listas del panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key === '/' && modo.t === 'lista' && el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA' && el?.tagName !== 'SELECT') {
        e.preventDefault();
        buscador.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modo.t]);

  const lista = useMemo(() => insumos ?? [], [insumos]);
  const cuentas = useMemo(() => ({
    todo: lista.length,
    rep: lista.filter((i) => estadoStock(i).k === 'rep').length,
    agot: lista.filter((i) => ['agot', 'neg'].includes(estadoStock(i).k)).length,
    sin: lista.filter((i) => !i.platosAsociados.length).length,
  }), [lista]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lista
      .filter((i) => {
        const e = estadoStock(i).k;
        if (filtro === 'rep' && e !== 'rep') return false;
        if (filtro === 'agot' && !['agot', 'neg'].includes(e)) return false;
        if (filtro === 'sin' && i.platosAsociados.length) return false;
        return !t || i.nombre.toLowerCase().includes(t);
      })
      .sort((a, b) => estadoStock(a).orden - estadoStock(b).orden || a.nombre.localeCompare(b.nombre));
  }, [lista, filtro, q]);

  const seleccionado = lista.find((i) => i.id === abierto) ?? null;

  if (insumos === null) {
    return <div className="flex h-64 items-center justify-center text-sm text-[var(--pizarra)]">Cargando inventario…</div>;
  }

  if (modo.t === 'compra') {
    return (
      <RecibirCompra
        insumos={lista}
        foco={modo.foco}
        onVolver={() => setModo({ t: 'lista' })}
        onGuardado={() => { setModo({ t: 'lista' }); cargar(); }}
      />
    );
  }
  if (modo.t === 'conteo') {
    return (
      <ContarStock
        insumos={lista}
        onVolver={() => setModo({ t: 'lista' })}
        onGuardado={() => { setModo({ t: 'lista' }); cargar(); }}
      />
    );
  }

  const tabs: Array<[Filtro, string, string]> = [['todo', 'Todo', ''], ['rep', 'Por reponer', 'aviso'], ['agot', 'Agotados', 'alerta'], ['sin', 'Sin plato', '']];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Stock</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--pizarra)]">
            <span className={`size-1.5 rounded-full ${conteo ? 'bg-[var(--ok)]' : 'bg-[var(--aviso)]'}`} />
            {conteo === undefined ? 'Cargando…' : conteo
              ? `Último conteo: ${fechaConDia(conteo.createdAt)}${conteo.usuario ? ` por ${conteo.usuario}` : ''} · ${conteo.diferencias === 0 ? 'todo cuadró' : `${conteo.diferencias} ${conteo.diferencias === 1 ? 'diferencia' : 'diferencias'}`}`
              : 'Todavía no se ha contado el stock'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setNuevo(true)} className={botonFantasmaCls}><Plus className="size-4" />Nuevo insumo</button>
          <button type="button" onClick={() => setModo({ t: 'conteo' })} className={botonCls}><ClipboardCheck className="size-4" />Contar stock</button>
          <button type="button" onClick={() => setModo({ t: 'compra' })} className={botonPrimarioCls}><Truck className="size-4" />Recibir compra</button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--linea)]">
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          {tabs.map(([k, t, tono]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filtro === k}
              onClick={() => setFiltro(k)}
              className={[
                '-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-2 text-[13.5px] font-medium whitespace-nowrap transition-colors',
                filtro === k ? 'border-[var(--tinta)] text-[var(--ink)]' : 'border-transparent text-[var(--pizarra)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {t}
              <b className={[
                'rounded-full px-1.5 text-xs font-semibold',
                cuentas[k] && tono === 'aviso' ? 'bg-[var(--aviso-tint)] text-[var(--aviso)]'
                  : cuentas[k] && tono === 'alerta' ? 'bg-[var(--alerta-tint)] text-[var(--alerta)]'
                  : 'bg-[var(--muted)] text-[var(--pizarra)]',
              ].join(' ')}>{cuentas[k]}</b>
            </button>
          ))}
        </div>
        <label className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--pizarra)]" />
          <input
            ref={buscador}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar insumo"
            aria-label="Buscar insumo"
            className="h-9 w-56 rounded-lg border border-[var(--linea)] bg-white pl-8 pr-8 text-[13px] outline-none focus:border-[var(--tinta)] focus:ring-2 focus:ring-[var(--tinta)]/20"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--linea)] bg-[#FAF9F6] px-1.5 text-[11px] font-semibold text-[var(--pizarra)]">/</kbd>
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
        <div className="hidden grid-cols-[minmax(180px,1.4fr)_minmax(170px,1.15fr)_minmax(150px,1fr)_minmax(110px,.7fr)_20px] items-center gap-4 bg-[#FAF9F6] px-4 py-2 text-xs font-semibold text-[var(--pizarra)] md:grid">
          <span>Insumo</span><span>En stock</span><span>Alcanza para</span><span>Hoy</span><span />
        </div>
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--pizarra)]">
            {lista.length === 0 ? 'Todavía no hay insumos. Crea el primero con «Nuevo insumo».' : q ? `Ningún insumo se llama «${q}».` : 'Nada en esta lista. Bien.'}
          </p>
        ) : visibles.map((i) => <Fila key={i.id} i={i} activa={abierto === i.id} onClick={() => setAbierto(i.id)} />)}
      </div>

      <PanelInsumo
        insumo={seleccionado}
        onClose={() => setAbierto(null)}
        onCambio={cargar}
        onRecibir={(id) => { setAbierto(null); setModo({ t: 'compra', foco: id }); }}
        onEditar={(i) => { setAbierto(null); setEditar(i); }}
      />
      <FormInsumo
        abierto={nuevo || !!editar}
        insumo={editar}
        onClose={() => { setNuevo(false); setEditar(null); }}
        onGuardado={() => { setNuevo(false); setEditar(null); cargar(); }}
      />
    </div>
  );
}

function Fila({ i, activa, onClick }: { i: InsumoStock; activa: boolean; onClick: () => void }) {
  const e = estadoStock(i);
  const tope = Math.max(i.minimo * 2.5, i.stockActual, 1);
  const pct = Math.min(100, (Math.max(i.stockActual, 0) / tope) * 100);
  const marca = i.minimo > 0 ? (i.minimo / tope) * 100 : null;
  const eta = etaAgota(i);
  const alterna = cantidadAlterna(i, i.stockActual);
  const platos = i.platosAsociados;
  const partes = platos.map((p) => ({ n: p.nombre, k: p.quedan }));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); } }}
      className={[
        'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-[var(--linea)] px-4 py-3 transition-colors first:border-t-0 md:grid-cols-[minmax(180px,1.4fr)_minmax(170px,1.15fr)_minmax(150px,1fr)_minmax(110px,.7fr)_20px]',
        activa ? 'bg-[var(--tinta-tint)]' : 'hover:bg-[#FAF9F6]',
      ].join(' ')}
    >
      <div className="min-w-0">
        <b className="block truncate text-sm font-semibold text-[var(--ink)]">{i.nombre}</b>
        <span className="text-xs text-[var(--pizarra)]">{i.grupo}{i.minimo > 0 && ` · mín. ${cantidadTexto(i, i.minimo)}`}</span>
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[15px] font-semibold text-[var(--ink)]">
          {cantidadTexto(i, i.stockActual)}
          {esFraccion(i) && alterna && <small className="text-xs font-medium text-[var(--pizarra)]">{alterna}</small>}
          {e.texto && (
            <span className={['rounded-full px-2 py-px text-[11.5px] font-semibold', e.tono === 'alerta' ? 'bg-[var(--alerta-tint)] text-[var(--alerta)]' : 'bg-[var(--aviso-tint)] text-[var(--aviso)]'].join(' ')}>{e.texto}</span>
          )}
        </div>
        <div className="relative h-[5px] max-w-[170px] rounded-[3px] bg-[var(--muted)]" aria-hidden>
          <i className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${pct}%`, background: e.tono ? `var(--${e.tono})` : 'var(--tinta)' }} />
          {marca !== null && <u className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-[var(--ink)] opacity-55" style={{ left: `${marca}%` }} />}
        </div>
        {eta && <span className="text-xs text-[var(--aviso)]">{eta}</span>}
      </div>
      <div className="col-span-2 text-[13px] leading-snug text-[#3a3e4a] md:col-span-1">
        {!platos.length ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-px text-[11.5px] font-semibold text-[var(--pizarra)]"><Link2Off className="size-3" />Sin plato vinculado</span>
            <br /><span className="text-xs text-[var(--pizarra)]">No descuenta al vender</span>
          </>
        ) : (
          <>
            {partes.slice(0, 3).map((p) => p.k > 0
              ? <div key={p.n}>{p.k} × {p.n}</div>
              : <div key={p.n} className="font-medium text-[var(--alerta)]">{p.n}: no alcanza</div>)}
            {partes.length > 3 && <div className="text-[var(--pizarra)]">+{partes.length - 3} más</div>}
          </>
        )}
      </div>
      <div className="hidden text-[13px] leading-snug md:block">
        <span className="text-[var(--pizarra)]">−{i.vendidoHoy} {plural(i.nombreUnidadMinima, i.vendidoHoy)}</span><br />
        <span className="text-[var(--ok)]">+{i.compradoHoy} compra</span>
      </div>
      <ChevronRight className="hidden size-4 text-[#a3a6b0] md:block" aria-hidden />
    </div>
  );
}

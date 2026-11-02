'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownWideNarrow, Armchair, Plus, Users, X } from 'lucide-react';
import type { Mesa, TipoMesa, Zona } from '@/lib/types';
import { etiquetaCorta, etiquetaMesa } from '@/lib/mesas';
import {
  BorradorPlano, MAX_DIM, REFERENCIAS_SUGERIDAS, Seleccion,
  cabe, colocarJuntoABarra, extensionUsada, mover, ocupacion, ordenarPorNumero, posicionDe, primeraLibre, tieneBarra,
} from './plano';
import { MesaFicha } from './MesaFicha';
import { AccionesLote } from './AccionesLote';
import { Campo, Segmentado, Stepper, botonCls, botonFantasmaCls, inputCls } from './controles';

interface Props {
  zona: Zona;
  zonas: Zona[];
  mesas: Mesa[];
  borrador: BorradorPlano;
  onCambio: (b: BorradorPlano) => void;
  seleccion: Seleccion;
  onSeleccion: (s: Seleccion) => void;
  onActualizarMesa: (id: string, data: Partial<{ numero: number; capacidad: number; zonaId: string; tipo: TipoMesa }>) => Promise<boolean>;
  onEliminarMesa: (mesa: Mesa) => void;
  onAgregar: () => void;
  multi: string[];
  onMulti: (ids: string[]) => void;
  onMoverVarias: (ids: string[], zonaId: string) => void;
  onEliminarVarias: (ids: string[]) => void;
}

const DRAG_TIPO = 'application/x-foxeats-plano';

// crypto.randomUUID solo existe en HTTPS o localhost; en la red local (http://192.168…) no.
const nuevoId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'ref-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function PlanoEditor({
  zona, zonas, mesas, borrador, onCambio, seleccion, onSeleccion, onActualizarMesa, onEliminarMesa, onAgregar,
  multi, onMulti, onMoverVarias, onEliminarVarias,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const planoRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  // Clic fuera del plano y del detalle: suelta la selección. Los paneles y
  // diálogos (portales con role=dialog) no cuentan como «fuera».
  const hayMulti = multi.length > 0;
  useEffect(() => {
    if (!seleccion && !hayMulti) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (planoRef.current?.contains(t) || inspectorRef.current?.contains(t)) return;
      if ((t as Element).closest?.('[role="dialog"]')) return;
      onSeleccion(null);
      onMulti([]);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [seleccion, hayMulti, onSeleccion, onMulti]);

  /** Clic en una mesa: con Shift/⌘/Ctrl suma o quita de la selección múltiple. */
  function clickMesa(e: React.MouseEvent, id: string) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const base = multi.length ? multi : seleccion?.tipo === 'mesa' ? [seleccion.id] : [];
      const ids = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      if (ids.length >= 2) { onSeleccion(null); onMulti(ids); }
      else { onMulti([]); onSeleccion(ids[0] ? { tipo: 'mesa', id: ids[0] } : null); }
      return;
    }
    onMulti([]);
    const ya = seleccion?.tipo === 'mesa' && seleccion.id === id;
    onSeleccion(ya ? null : { tipo: 'mesa', id });
  }

  function quitarVariasDelPlano() {
    const pos = { ...borrador.pos };
    for (const id of multi) if (pos[id]) pos[id] = { ...pos[id], fila: null, col: null };
    onCambio({ ...borrador, pos });
  }
  const mesaPorId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);
  const occ = useMemo(() => ocupacion(borrador), [borrador]);

  const sinUbicar = mesas
    .filter((m) => { const p = borrador.pos[m.id]; return !p || p.fila === null || p.col === null; })
    .sort((a, b) => a.numero - b.numero);
  const ubicadas = mesas.length - sinUbicar.length;
  const puestosSinUbicar = sinUbicar.filter((m) => m.tipo === 'barra').length;

  const posSel = seleccion ? posicionDe(borrador, seleccion) : null;
  const anchoSel = posSel?.ancho ?? 1;
  const altoSel = posSel?.alto ?? 1;

  // ── Acciones ────────────────────────────────────────────
  function colocar(sel: Exclude<Seleccion, null>, fila: number, col: number) {
    const p = posicionDe(borrador, sel);
    if (!cabe(borrador, fila, col, p?.ancho ?? 1, sel, p?.alto ?? 1)) return false;
    onCambio(mover(borrador, sel, fila, col));
    return true;
  }

  function clickCelda(fila: number, col: number) {
    const ocupante = occ.get(`${fila},${col}`);
    if (hayMulti) { onMulti([]); if (ocupante) onSeleccion(ocupante); return; }
    if (seleccion && !(ocupante && ocupante.tipo === seleccion.tipo && ocupante.id === seleccion.id)) {
      if (colocar(seleccion, fila, col)) return;
    }
    // Celda vacía donde no cabe: soltar la selección
    onSeleccion(ocupante ?? null);
  }

  function quitarSeleccion() {
    if (!seleccion) return;
    if (seleccion.tipo === 'mesa') {
      onCambio({ ...borrador, pos: { ...borrador.pos, [seleccion.id]: { ...borrador.pos[seleccion.id], fila: null, col: null } } });
    } else {
      onCambio({ ...borrador, referencias: borrador.referencias.filter((r) => r.id !== seleccion.id) });
      onSeleccion(null);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (hayMulti) {
      if (e.key === 'Escape') onMulti([]);
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitarVariasDelPlano(); }
      return;
    }
    if (!seleccion) return;
    if (e.key === 'Escape') { onSeleccion(null); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitarSeleccion(); return; }
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[e.key];
    if (!d || !posSel || posSel.fila === null || posSel.col === null) return;
    e.preventDefault();
    colocar(seleccion, posSel.fila + d[0], posSel.col + d[1]);
  }

  /** Cambia el tamaño del elemento elegido si el espacio nuevo está libre. */
  function redimensionar(ancho: number, alto: number) {
    if (!seleccion || !posSel) return;
    if (posSel.fila !== null && posSel.col !== null && !cabe(borrador, posSel.fila, posSel.col, ancho, seleccion, alto)) {
      toast.error(alto > posSel.alto
        ? 'No hay espacio libre debajo para hacerla más alta'
        : 'No hay espacio libre a la derecha para ensancharla');
      return;
    }
    if (seleccion.tipo === 'mesa') {
      onCambio({ ...borrador, pos: { ...borrador.pos, [seleccion.id]: { ...borrador.pos[seleccion.id], ancho } } });
    } else {
      onCambio({ ...borrador, referencias: borrador.referencias.map((r) => (r.id === seleccion.id ? { ...r, ancho, alto } : r)) });
    }
  }

  function agregarReferencia(etiqueta: string) {
    const ancho = etiqueta === 'Barra' ? 3 : 1;
    let lugar = primeraLibre(borrador, ancho) ?? primeraLibre(borrador, 1);
    let b = borrador;
    if (!lugar && b.filas < MAX_DIM) {
      b = { ...b, filas: b.filas + 1 };
      lugar = primeraLibre(b, ancho) ?? primeraLibre(b, 1);
    }
    if (!lugar) { toast.error('No queda espacio en el plano'); return; }
    const anchoFinal = cabe(b, lugar.fila, lugar.col, ancho) ? ancho : 1;
    const ref = { id: nuevoId(), etiqueta, fila: lugar.fila, col: lugar.col, ancho: anchoFinal, alto: 1 };
    onCambio({ ...b, referencias: [...b.referencias, ref] });
    onSeleccion({ tipo: 'ref', id: ref.id });
  }

  function cambiarDim(campo: 'filas' | 'columnas', valor: number) {
    const usada = extensionUsada(borrador);
    if (valor < usada[campo]) {
      toast.error(campo === 'filas'
        ? 'Hay elementos en la última fila: muévelos antes de quitarla'
        : 'Hay elementos en la última columna: muévelos antes de quitarla');
      return;
    }
    onCambio({ ...borrador, [campo]: valor });
  }

  // ── Arrastre (escritorio) ───────────────────────────────
  function onDragStart(e: React.DragEvent, sel: Exclude<Seleccion, null>) {
    e.dataTransfer.setData(DRAG_TIPO, `${sel.tipo}:${sel.id}`);
    e.dataTransfer.effectAllowed = 'move';
    onSeleccion(sel);
    setArrastrando(true);
  }
  function leerDrag(e: React.DragEvent): Exclude<Seleccion, null> | null {
    const raw = e.dataTransfer.getData(DRAG_TIPO);
    const [tipo, id] = raw.split(':');
    return (tipo === 'mesa' || tipo === 'ref') && id ? { tipo, id } : null;
  }

  const selMesa = seleccion?.tipo === 'mesa' ? mesaPorId.get(seleccion.id) : undefined;
  const selRef = seleccion?.tipo === 'ref' ? borrador.referencias.find((r) => r.id === seleccion.id) : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" onKeyDown={onKeyDown}>
      {/* Lienzo */}
      <section aria-label={`Plano de ${zona.nombre}`} className="min-w-0 rounded-[10px] border border-[var(--linea)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-[var(--pizarra)] tabular-nums">
            {borrador.columnas} × {borrador.filas} · {ubicadas} de {mesas.length} mesa{mesas.length !== 1 ? 's' : ''} ubicada{ubicadas !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            className={botonFantasmaCls}
            disabled={mesas.length === 0}
            onClick={() => { onCambio(ordenarPorNumero(borrador, mesas)); onSeleccion(null); }}
          >
            <ArrowDownWideNarrow className="size-3.5" aria-hidden /> Ordenar por número
          </button>
        </div>

        {mesas.length === 0 && borrador.referencias.length === 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--linea)] px-4 py-3">
            <p className="text-[13px] text-[var(--pizarra)]">
              <b className="font-semibold text-[var(--ink)]">Esta zona aún no tiene mesas.</b> Agrégalas y luego colócalas en el plano, o usa «Ordenar por número».
            </p>
            <button type="button" onClick={onAgregar} className={botonCls}><Plus className="size-3.5" aria-hidden /> Agregar mesas</button>
          </div>
        )}

        <div ref={planoRef} className="w-fit max-w-full overflow-x-auto rounded-lg">
          <div
            role="grid"
            aria-label="Celdas del plano"
            className="grid w-fit gap-2 rounded-lg bg-[#FBFAF7] p-2.5 [background-image:radial-gradient(circle,#D5D2C8_1.1px,transparent_1.3px)] [background-size:22px_22px]"
            style={{
              // Celdas de 58–96 px: legibles en tablet sin volverse enormes en escritorio
              gridTemplateColumns: `repeat(${borrador.columnas}, minmax(58px, 96px))`,
              minWidth: borrador.columnas * 66,
            }}
          >
            {/* Celdas libres (destinos) */}
            {Array.from({ length: borrador.filas * borrador.columnas }, (_, i) => {
              const fila = Math.floor(i / borrador.columnas);
              const col = i % borrador.columnas;
              const ocupante = occ.get(`${fila},${col}`);
              const destino = !!seleccion && !ocupante && cabe(borrador, fila, col, anchoSel, seleccion, altoSel);
              return (
                <button
                  key={`c-${fila}-${col}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={ocupante ? undefined : `Celda fila ${fila + 1}, columna ${col + 1}`}
                  onClick={() => clickCelda(fila, col)}
                  onDragOver={(e) => { if (!ocupante) e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                    const sel = leerDrag(e);
                    if (sel && !colocar(sel, fila, col)) toast.error('No cabe en ese lugar');
                  }}
                  style={{ gridRow: fila + 1, gridColumn: col + 1 }}
                  className={[
                    'aspect-square rounded-lg border transition-colors duration-150',
                    destino
                      ? 'cursor-pointer border-dashed border-[var(--tinta)]/45 hover:border-[var(--tinta)] hover:bg-[var(--tinta-tint)]'
                      : ocupante ? 'border-transparent' : 'cursor-default border-dashed border-[#E6E3DB]',
                    arrastrando && !ocupante ? 'border-dashed border-[var(--tinta)]/30' : '',
                  ].join(' ')}
                />
              );
            })}

            {/* Referencias */}
            {borrador.referencias.map((r) => {
              const sel = seleccion?.tipo === 'ref' && seleccion.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  draggable
                  onDragStart={(e) => onDragStart(e, { tipo: 'ref', id: r.id })}
                  onDragEnd={() => setArrastrando(false)}
                  onClick={() => onSeleccion(sel ? null : { tipo: 'ref', id: r.id })}
                  aria-pressed={sel}
                  style={{ gridRow: `${r.fila + 1} / span ${r.alto ?? 1}`, gridColumn: `${r.col + 1} / span ${r.ancho}` }}
                  className={[
                    'z-10 flex cursor-grab items-center justify-center rounded-lg px-1 text-[11px] font-semibold tracking-[0.02em] text-[var(--pizarra)] active:cursor-grabbing',
                    '[background:repeating-linear-gradient(135deg,#EFEDE6_0_6px,#E6E3DA_6px_12px)]',
                    sel ? 'ring-3 ring-[var(--aji)]' : 'hover:text-[var(--ink)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                  ].join(' ')}
                >
                  <span className="truncate">{r.etiqueta}</span>
                </button>
              );
            })}

            {/* Mesas */}
            {mesas.map((m) => {
              const p = borrador.pos[m.id];
              if (!p || p.fila === null || p.col === null) return null;
              const sel = (seleccion?.tipo === 'mesa' && seleccion.id === m.id) || multi.includes(m.id);
              const ocupada = m.estado === 'ocupada';
              const borde = sel
                ? 'z-20 border-[var(--tinta)] shadow-[0_0_0_3px_var(--aji),0_6px_14px_-6px_rgba(31,42,77,0.4)]'
                : [ocupada ? 'border-[#B9BED3]' : 'border-[#C9CBD6]', 'shadow-[0_1px_2px_rgba(22,25,34,0.06)] hover:border-[var(--tinta)]/60'].join(' ');
              if (m.tipo === 'barra') {
                // Taburete: círculo dentro de su celda
                return (
                  <button
                    key={m.id}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, { tipo: 'mesa', id: m.id })}
                    onDragEnd={() => setArrastrando(false)}
                    onClick={(e) => clickMesa(e, m.id)}
                    aria-pressed={sel}
                    aria-label={`${etiquetaMesa(m, mesas)}, número ${m.numero}${ocupada ? ', ocupada' : ''}`}
                    style={{ gridRow: p.fila + 1, gridColumn: p.col + 1 }}
                    className={[
                      'relative z-10 m-auto flex aspect-square w-[74%] cursor-grab flex-col items-center justify-center rounded-full border-[1.5px] transition-shadow duration-150 active:cursor-grabbing',
                      ocupada ? 'bg-[var(--tinta-tint)]' : 'bg-white',
                      borde,
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                    ].join(' ')}
                  >
                    <b className="text-[15px] leading-none font-semibold text-[var(--ink)]">{etiquetaCorta(m, mesas)}</b>
                    <span className="mt-0.5 text-[10.5px] leading-none text-[var(--pizarra)] tabular-nums">{m.numero}</span>
                  </button>
                );
              }
              return (
                <button
                  key={m.id}
                  type="button"
                  draggable
                  onDragStart={(e) => onDragStart(e, { tipo: 'mesa', id: m.id })}
                  onDragEnd={() => setArrastrando(false)}
                  onClick={(e) => clickMesa(e, m.id)}
                  aria-pressed={sel}
                  aria-label={`Mesa ${m.numero}, ${m.capacidad ?? '—'} personas${ocupada ? ', ocupada' : ''}`}
                  style={{ gridRow: p.fila + 1, gridColumn: `${p.col + 1} / span ${p.ancho}` }}
                  className={[
                    'relative z-10 flex cursor-grab flex-col items-center justify-center gap-0.5 rounded-[9px] border-[1.5px] transition-shadow duration-150 active:cursor-grabbing',
                    ocupada ? 'bg-[var(--tinta-tint)]' : 'bg-white',
                    borde,
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                  ].join(' ')}
                >
                  <b className="text-lg leading-none font-semibold text-[var(--ink)] tabular-nums">{m.numero}</b>
                  <span className="flex items-center gap-0.5 text-[11px] text-[var(--pizarra)]">
                    <Users className="size-3" aria-hidden />{m.capacidad ?? '—'}
                  </span>
                  {ocupada && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[var(--tinta)]" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3 text-xs text-[var(--pizarra)]">
          Toca una mesa y luego una celda libre para moverla. Con teclado: <Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> mueven,
          {' '}<Kbd>Supr</Kbd> la quita del plano y <Kbd>Esc</Kbd> la suelta. <Kbd>Shift</Kbd> + clic elige varias.
        </p>
      </section>

      {/* Inspector */}
      <aside ref={inspectorRef} className="flex min-w-0 flex-col gap-4" aria-label="Detalle">
        {multi.length >= 2 && (
          <AccionesLote
            elegidas={mesas.filter((m) => multi.includes(m.id))}
            todas={mesas}
            zonas={zonas}
            zonaActual={zona.id}
            onMover={(z) => onMoverVarias(multi, z)}
            onEliminar={() => onEliminarVarias(multi)}
            onQuitarDelPlano={quitarVariasDelPlano}
            onLimpiar={() => onMulti([])}
          />
        )}

        {selMesa && posSel && (
          <Tarjeta>
            <MesaFicha
              mesa={selMesa}
              todas={mesas}
              zonas={zonas}
              onActualizar={(data) => onActualizarMesa(selMesa.id, data)}
              onEliminar={() => onEliminarMesa(selMesa)}
            >
              {selMesa.tipo !== 'barra' && <Campo label="Tamaño en el plano">
                <Segmentado
                  etiqueta="Tamaño en el plano"
                  value={posSel.ancho === 2 ? '2' : '1'}
                  opciones={[{ value: '1', label: '1 celda' }, { value: '2', label: 'Ancha' }]}
                  onChange={(v) => redimensionar(Number(v), 1)}
                />
              </Campo>}
              {posSel.fila !== null ? (
                <button type="button" onClick={quitarSeleccion} className={[botonFantasmaCls, '-ml-2'].join(' ')}>
                  <X className="size-3.5" aria-hidden /> Quitar del plano
                </button>
              ) : (
                <p className="text-xs text-[var(--pizarra)]">Sin ubicar: toca una celda libre del plano para colocarla.</p>
              )}
            </MesaFicha>
          </Tarjeta>
        )}

        {selRef && (
          <Tarjeta>
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">Referencia</h3>
              <Campo label="Nombre" htmlFor="ref-nombre">
                <input
                  id="ref-nombre"
                  value={selRef.etiqueta}
                  maxLength={24}
                  onChange={(e) => onCambio({
                    ...borrador,
                    referencias: borrador.referencias.map((r) => (r.id === selRef.id ? { ...r, etiqueta: e.target.value } : r)),
                  })}
                  className={inputCls}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Ancho">
                  <Stepper etiqueta="ancho" value={selRef.ancho} min={1} max={borrador.columnas} onChange={(n) => redimensionar(n, selRef.alto ?? 1)} />
                </Campo>
                <Campo label="Alto">
                  <Stepper etiqueta="alto" value={selRef.alto ?? 1} min={1} max={borrador.filas} onChange={(n) => redimensionar(selRef.ancho, n)} />
                </Campo>
              </div>
              <p className="-mt-2 text-xs text-[var(--pizarra)]">En celdas. Crece hacia la derecha y hacia abajo.</p>
              <button type="button" onClick={quitarSeleccion} className={[botonFantasmaCls, '-ml-2'].join(' ')}>
                <X className="size-3.5" aria-hidden /> Quitar referencia
              </button>
            </div>
          </Tarjeta>
        )}

        <Tarjeta
          titulo="Sin ubicar"
          extra={String(sinUbicar.length)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            const sel = leerDrag(e);
            if (sel?.tipo === 'mesa') {
              onCambio({ ...borrador, pos: { ...borrador.pos, [sel.id]: { ...borrador.pos[sel.id], fila: null, col: null } } });
            }
          }}
        >
          {sinUbicar.length === 0 ? (
            <p className="text-[13px] text-[var(--pizarra)]">
              {mesas.length === 0 ? 'Esta zona aún no tiene mesas.' : 'Todas las mesas están en el plano.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {sinUbicar.map((m) => {
                  const sel = (seleccion?.tipo === 'mesa' && seleccion.id === m.id) || multi.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      draggable
                      onDragStart={(e) => onDragStart(e, { tipo: 'mesa', id: m.id })}
                      onDragEnd={() => setArrastrando(false)}
                      onClick={(e) => clickMesa(e, m.id)}
                      aria-pressed={sel}
                      className={[
                        'min-w-10 cursor-grab border-[1.5px] bg-white px-2.5 py-1 text-sm font-semibold text-[var(--ink)] tabular-nums',
                        m.tipo === 'barra' ? 'rounded-full' : 'rounded-lg',
                        sel ? 'border-[var(--tinta)] shadow-[0_0_0_3px_var(--aji)]' : 'border-[#C9CBD6] hover:border-[var(--tinta)]/60',
                      ].join(' ')}
                    >
                      {m.tipo === 'barra' ? <>{etiquetaCorta(m, mesas)} <span className="font-normal text-[var(--pizarra)]">{m.numero}</span></> : m.numero}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs text-[var(--pizarra)]">Elige una y toca una celda libre del plano.</p>
              {puestosSinUbicar > 0 && (tieneBarra(borrador) ? (
                <button
                  type="button"
                  onClick={() => {
                    const r = colocarJuntoABarra(borrador, mesas);
                    onCambio(r.borrador);
                    if (r.faltan > 0) toast.error(`No hay espacio junto a la barra para ${r.faltan} puesto${r.faltan !== 1 ? 's' : ''}`);
                  }}
                  className={[botonCls, 'mt-3 w-full'].join(' ')}
                >
                  <Armchair className="size-3.5" aria-hidden /> Colocar puestos junto a la barra
                </button>
              ) : (
                <p className="mt-2 text-xs text-[var(--pizarra)]">Agrega la referencia «Barra» para colocar los puestos junto a ella con un clic.</p>
              ))}
            </>
          )}
        </Tarjeta>

        {!seleccion && !hayMulti && (
          <>
            <Tarjeta titulo="Tamaño del plano">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Columnas">
                  <Stepper etiqueta="columnas" value={borrador.columnas} min={1} max={MAX_DIM} onChange={(n) => cambiarDim('columnas', n)} />
                </Campo>
                <Campo label="Filas">
                  <Stepper etiqueta="filas" value={borrador.filas} min={1} max={MAX_DIM} onChange={(n) => cambiarDim('filas', n)} />
                </Campo>
              </div>
            </Tarjeta>
            <Tarjeta titulo="Referencias">
              <p className="mb-2.5 text-xs text-[var(--pizarra)]">Bloques fijos que ayudan a ubicarse. El mesero los ve, pero no se pueden ocupar.</p>
              <div className="flex flex-wrap gap-1.5">
                {REFERENCIAS_SUGERIDAS.map((r) => (
                  <button key={r} type="button" onClick={() => agregarReferencia(r)} className={[botonCls, 'px-2.5 py-1 text-xs'].join(' ')}>
                    <Plus className="size-3" aria-hidden />{r}
                  </button>
                ))}
              </div>
            </Tarjeta>
          </>
        )}
      </aside>
    </div>
  );
}

function Tarjeta({ titulo, extra, children, ...rest }: {
  titulo?: string; extra?: string; children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section {...rest} className="rounded-[10px] border border-[var(--linea)] bg-white">
      {titulo && (
        <header className="flex items-center justify-between border-b border-[var(--linea)] px-4 py-2.5">
          <h3 className="text-sm font-semibold text-[var(--ink)]">{titulo}</h3>
          {extra && <span className="text-xs text-[var(--pizarra)] tabular-nums">{extra}</span>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-px rounded border border-b-2 border-[var(--linea)] bg-white px-1 font-sans text-[11px] font-semibold text-[var(--ink)]">
      {children}
    </kbd>
  );
}

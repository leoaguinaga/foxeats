'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Minus, Search, X } from 'lucide-react';
import type { CategoriaCarta, PlatoCarta, Promocion, TipoDescuento, UpsertPromocion } from '@/lib/types';
import {
  DIAS, PRESETS_DIAS, etiquetaDescuento, precioConPromo, resumenDias, resumenHorario, soles,
} from '@/lib/promociones';
import { Segmentado, inputCls } from '@/components/admin/salon/controles';

export type BorradorPromo = UpsertPromocion & { activo: boolean };

export const BORRADOR_VACIO: BorradorPromo = {
  nombre: '',
  descripcion: null,
  tipoDescuento: 'porcentaje',
  valorDescuento: '',
  diasSemana: [1, 2, 3, 4, 5, 6, 7],
  horaInicio: null,
  horaFin: null,
  vigenteDesde: null,
  vigenteHasta: null,
  activo: true,
  platoCartaIds: [],
};

export function borradorDesde(p: Promocion): BorradorPromo {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion,
    tipoDescuento: p.tipoDescuento,
    valorDescuento: String(parseFloat(p.valorDescuento)),
    diasSemana: p.diasSemana,
    horaInicio: p.horaInicio?.slice(0, 5) ?? null,
    horaFin: p.horaFin?.slice(0, 5) ?? null,
    vigenteDesde: p.vigenteDesde,
    vigenteHasta: p.vigenteHasta,
    activo: p.activo,
    platoCartaIds: p.platoCartaIds,
  };
}

const VALORES_RAPIDOS: Record<TipoDescuento, string[]> = {
  porcentaje: ['10', '15', '20', '25'],
  monto_fijo: ['1', '2', '3', '5'],
};

/** Nombre que se usa si el administrador no escribe uno. */
export function nombreSugerido(b: BorradorPromo): string {
  const valor = parseFloat(b.valorDescuento);
  const desc = Number.isFinite(valor) && valor > 0 ? etiquetaDescuento(b) : 'Descuento';
  const dias = resumenDias(b.diasSemana);
  return `${desc} · ${dias.charAt(0).toLowerCase()}${dias.slice(1)}`;
}

export type ErroresPromo = Partial<Record<'valor' | 'platos' | 'dias' | 'horario' | 'fechas', string>>;

export function validarBorrador(b: BorradorPromo): ErroresPromo {
  const e: ErroresPromo = {};
  const v = parseFloat(b.valorDescuento);
  if (!Number.isFinite(v) || v <= 0) e.valor = 'Indica cuánto se descuenta.';
  else if (b.tipoDescuento === 'porcentaje' && v > 100) e.valor = 'El porcentaje no puede pasar de 100.';
  if (b.platoCartaIds.length === 0) e.platos = 'Elige al menos un plato.';
  if (b.diasSemana.length === 0) e.dias = 'Elige al menos un día.';
  if (b.horaInicio && b.horaFin && b.horaInicio >= b.horaFin) e.horario = 'La hora de inicio debe ser antes que la de fin.';
  if (b.vigenteDesde && b.vigenteHasta && b.vigenteDesde > b.vigenteHasta) e.fechas = 'La fecha de inicio debe ser antes que la de fin.';
  return e;
}

function Seccion({ titulo, ayuda, error, children }: {
  titulo: string; ayuda?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-[var(--linea)] pt-5 first:border-t-0 first:pt-1">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--ink)]">{titulo}</h3>
        {ayuda && <p className="mt-0.5 text-[13px] text-[var(--pizarra)]">{ayuda}</p>}
      </div>
      {children}
      {error && <p role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error}</p>}
    </section>
  );
}

function Casilla({ estado }: { estado: 'si' | 'no' | 'parcial' }) {
  return (
    <span
      aria-hidden
      className={[
        'grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors',
        estado === 'no' ? 'border-[#B9BBC6] bg-white' : 'border-[var(--tinta)] bg-[var(--tinta)] text-white',
      ].join(' ')}
    >
      {estado === 'si' && <Check className="size-3" strokeWidth={3} />}
      {estado === 'parcial' && <Minus className="size-3" strokeWidth={3} />}
    </span>
  );
}

export function PromoForm({ borrador, onChange, errores, platos, categorias, otras, editandoId }: {
  borrador: BorradorPromo;
  onChange: (b: BorradorPromo) => void;
  errores: ErroresPromo;
  platos: PlatoCarta[];
  categorias: CategoriaCarta[];
  otras: Promocion[];
  editandoId: string | null;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [conHorario, setConHorario] = useState(Boolean(borrador.horaInicio || borrador.horaFin));
  const [conFechas, setConFechas] = useState(Boolean(borrador.vigenteDesde || borrador.vigenteHasta));
  const set = (cambio: Partial<BorradorPromo>) => onChange({ ...borrador, ...cambio });

  const elegidos = useMemo(() => new Set(borrador.platoCartaIds), [borrador.platoCartaIds]);
  const valorOk = parseFloat(borrador.valorDescuento) > 0;
  const promoPreview = valorOk ? borrador : null;

  const grupos = useMemo(() => {
    const q = busqueda.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const visibles = platos.filter((p) =>
      p.activo && (!q || p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)));
    const orden = [...categorias].sort((a, b) => a.orden - b.orden);
    const res = orden
      .map((c) => ({ cat: c, items: visibles.filter((p) => (p.categoria?.id ?? p.categoriaId) === c.id) }))
      .filter((g) => g.items.length > 0);
    const sinCat = visibles.filter((p) => !orden.some((c) => c.id === (p.categoria?.id ?? p.categoriaId)));
    if (sinCat.length) res.push({ cat: { id: '_', nombre: 'Otros' } as CategoriaCarta, items: sinCat });
    return res;
  }, [platos, categorias, busqueda]);

  function togglePlato(id: string) {
    set({ platoCartaIds: elegidos.has(id) ? borrador.platoCartaIds.filter((x) => x !== id) : [...borrador.platoCartaIds, id] });
  }

  function toggleGrupo(ids: string[]) {
    const todos = ids.every((id) => elegidos.has(id));
    set({
      platoCartaIds: todos
        ? borrador.platoCartaIds.filter((x) => !ids.includes(x))
        : Array.from(new Set([...borrador.platoCartaIds, ...ids])),
    });
  }

  function toggleDia(iso: number) {
    const dias = borrador.diasSemana.includes(iso)
      ? borrador.diasSemana.filter((d) => d !== iso)
      : [...borrador.diasSemana, iso].sort((a, b) => a - b);
    set({ diasSemana: dias });
  }

  // Un plato recibe una sola promo: si otra activa lo cubre el mismo día, gana la más antigua.
  const choques = useMemo(() => {
    const res: Array<{ plato: string; promo: string }> = [];
    for (const o of otras) {
      if (o.id === editandoId || !o.activo) continue;
      if (!o.diasSemana.some((d) => borrador.diasSemana.includes(d))) continue;
      for (const id of o.platoCartaIds) {
        if (elegidos.has(id)) {
          const nombre = platos.find((p) => p.id === id)?.nombre;
          if (nombre) res.push({ plato: nombre, promo: o.nombre });
        }
      }
    }
    return res;
  }, [otras, editandoId, borrador.diasSemana, elegidos, platos]);

  const elegidosLista = borrador.platoCartaIds
    .map((id) => platos.find((p) => p.id === id))
    .filter((p): p is PlatoCarta => Boolean(p));

  return (
    <div className="space-y-5">
      <Seccion titulo="Descuento" error={errores.valor}>
        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            etiqueta="Tipo de descuento"
            value={borrador.tipoDescuento}
            onChange={(v) => set({ tipoDescuento: v, valorDescuento: '' })}
            opciones={[{ value: 'porcentaje', label: 'Porcentaje' }, { value: 'monto_fijo', label: 'Soles por plato' }]}
          />
          <div className="relative w-[120px]">
            {borrador.tipoDescuento === 'monto_fijo' && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--pizarra)]">S/</span>
            )}
            <input
              id="promo-valor"
              type="number"
              inputMode="decimal"
              min="0"
              step={borrador.tipoDescuento === 'porcentaje' ? '1' : '0.10'}
              aria-label={borrador.tipoDescuento === 'porcentaje' ? 'Porcentaje de descuento' : 'Soles de descuento por plato'}
              aria-invalid={Boolean(errores.valor)}
              value={borrador.valorDescuento}
              onChange={(e) => set({ valorDescuento: e.target.value })}
              placeholder="0"
              className={[inputCls, 'h-10 text-[15px] font-semibold', borrador.tipoDescuento === 'monto_fijo' ? 'pl-9' : 'pr-8'].join(' ')}
            />
            {borrador.tipoDescuento === 'porcentaje' && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--pizarra)]">%</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Valores frecuentes">
          {VALORES_RAPIDOS[borrador.tipoDescuento].map((v) => {
            const on = parseFloat(borrador.valorDescuento) === parseFloat(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => set({ valorDescuento: v })}
                aria-pressed={on}
                className={[
                  'h-8 rounded-full border px-3 text-[13px] font-medium tabular-nums transition-colors',
                  on ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:border-[var(--tinta)]/40 hover:bg-[var(--tinta-tint)]',
                ].join(' ')}
              >
                {borrador.tipoDescuento === 'porcentaje' ? `${v} %` : `S/ ${v}`}
              </button>
            );
          })}
        </div>
      </Seccion>

      <Seccion
        titulo="Platos"
        ayuda={elegidosLista.length ? `${elegidosLista.length} ${elegidosLista.length === 1 ? 'plato elegido' : 'platos elegidos'}` : 'Elige platos sueltos o una categoría entera.'}
        error={errores.platos}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--pizarra)]" strokeWidth={1.9} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la carta"
            aria-label="Buscar plato"
            className={[inputCls, 'pl-9'].join(' ')}
          />
        </div>

        <div className="max-h-[340px] overflow-y-auto rounded-[10px] border border-[var(--linea)]">
          {grupos.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--pizarra)]">Ningún plato coincide con «{busqueda}».</p>
          )}
          {grupos.map(({ cat, items }) => {
            const ids = items.map((p) => p.id);
            const n = ids.filter((id) => elegidos.has(id)).length;
            const estado = n === 0 ? 'no' : n === ids.length ? 'si' : 'parcial';
            return (
              <div key={cat.id} className="border-b border-[var(--linea)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleGrupo(ids)}
                  aria-pressed={estado === 'si'}
                  className="sticky top-0 z-[1] flex w-full items-center gap-3 bg-[#F8F7F4] px-3 py-2 text-left hover:bg-[var(--tinta-tint)]"
                >
                  <Casilla estado={estado} />
                  <span className="flex-1 text-[12.5px] font-semibold text-[var(--ink)]">{cat.nombre}</span>
                  <span className="text-[12px] text-[var(--pizarra)] tabular-nums">
                    {n > 0 ? `${n} de ${ids.length}` : `Toda la categoría · ${ids.length}`}
                  </span>
                </button>
                <ul>
                  {items.map((p) => {
                    const on = elegidos.has(p.id);
                    const precio = parseFloat(p.precio);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => togglePlato(p.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--muted)]"
                        >
                          <Casilla estado={on ? 'si' : 'no'} />
                          <span className="flex-1 truncate text-[13.5px] text-[var(--ink)]">{p.nombre}</span>
                          {on && promoPreview ? (
                            <span className="flex items-baseline gap-1.5 tabular-nums">
                              <s className="text-[12px] text-[var(--pizarra)]">{soles(precio)}</s>
                              <span className="text-[13px] font-semibold text-[var(--ink)]">{soles(precioConPromo(precio, promoPreview))}</span>
                            </span>
                          ) : (
                            <span className="text-[13px] text-[var(--pizarra)] tabular-nums">{soles(precio)}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {elegidosLista.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Platos elegidos">
            {elegidosLista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => togglePlato(p.id)}
                  aria-label={`Quitar ${p.nombre}`}
                  className="group inline-flex h-7 items-center gap-1 rounded-full bg-[var(--tinta-tint)] pl-2.5 pr-1.5 text-[12.5px] font-medium text-[var(--tinta)] hover:bg-[#DCE0EC]"
                >
                  {p.nombre}
                  <X className="size-3.5 opacity-60 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {choques.length > 0 && (
          <div className="flex gap-2.5 rounded-[10px] bg-[var(--aviso-tint)] px-3 py-2.5 text-[13px] text-[#7A3B08]">
            <AlertTriangle className="mt-px size-4 shrink-0 text-[var(--aviso)]" strokeWidth={1.9} />
            <p>
              {choques.slice(0, 2).map((c) => `${c.plato} ya está en «${c.promo}»`).join('; ')}
              {choques.length > 2 && ` y ${choques.length - 2} más`}. Cada plato lleva una sola promo; si coinciden el mismo día, se aplica la que se creó primero.
            </p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cuándo se aplica" error={errores.dias ?? errores.horario ?? errores.fechas}>
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS_DIAS.map((p) => {
              const on = p.dias.join() === [...borrador.diasSemana].sort((a, b) => a - b).join();
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ diasSemana: p.dias })}
                  className={[
                    'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
                    on ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white' : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:border-[var(--tinta)]/40 hover:bg-[var(--tinta-tint)]',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
            {DIAS.map((d) => {
              const on = borrador.diasSemana.includes(d.iso);
              return (
                <button
                  key={d.iso}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.largo}
                  onClick={() => toggleDia(d.iso)}
                  className={[
                    'h-10 rounded-lg border text-[13px] font-semibold transition-colors',
                    on ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] bg-white text-[var(--pizarra)] hover:text-[var(--ink)]',
                  ].join(' ')}
                >
                  {d.corto}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <Segmentado
            etiqueta="Horario"
            value={conHorario ? 'horario' : 'todo'}
            onChange={(v) => {
              setConHorario(v === 'horario');
              set(v === 'horario' ? { horaInicio: borrador.horaInicio ?? '12:00', horaFin: borrador.horaFin ?? '15:00' } : { horaInicio: null, horaFin: null });
            }}
            opciones={[{ value: 'todo', label: 'Todo el día' }, { value: 'horario', label: 'Solo un horario' }]}
          />
          {conHorario && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--pizarra)]">
              De
              <input type="time" aria-label="Hora de inicio" value={borrador.horaInicio ?? ''} onChange={(e) => set({ horaInicio: e.target.value || null })} className={[inputCls, 'w-[120px]'].join(' ')} />
              a
              <input type="time" aria-label="Hora de fin" value={borrador.horaFin ?? ''} onChange={(e) => set({ horaFin: e.target.value || null })} className={[inputCls, 'w-[120px]'].join(' ')} />
            </div>
          )}
        </div>

        <div className="space-y-2.5 pt-1">
          <Segmentado
            etiqueta="Fechas"
            value={conFechas ? 'fechas' : 'siempre'}
            onChange={(v) => {
              setConFechas(v === 'fechas');
              if (v === 'siempre') set({ vigenteDesde: null, vigenteHasta: null });
            }}
            opciones={[{ value: 'siempre', label: 'Sin fecha de fin' }, { value: 'fechas', label: 'Entre fechas' }]}
          />
          {conFechas && (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--pizarra)]">
              Del
              <input type="date" aria-label="Desde" value={borrador.vigenteDesde ?? ''} onChange={(e) => set({ vigenteDesde: e.target.value || null })} className={[inputCls, 'w-[150px]'].join(' ')} />
              al
              <input type="date" aria-label="Hasta" value={borrador.vigenteHasta ?? ''} onChange={(e) => set({ vigenteHasta: e.target.value || null })} className={[inputCls, 'w-[150px]'].join(' ')} />
            </div>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Nombre" ayuda="Lo ven el mesero al tomar el pedido y la caja en la cuenta.">
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) => set({ nombre: e.target.value })}
          placeholder={nombreSugerido(borrador)}
          aria-label="Nombre de la promoción"
          maxLength={60}
          className={[inputCls, 'h-10'].join(' ')}
        />
      </Seccion>

      <p className="rounded-[10px] bg-[var(--piedra)] px-3.5 py-3 text-[13.5px] leading-relaxed text-[var(--ink)]">
        {resumenFrase(borrador, elegidosLista)}
      </p>
    </div>
  );
}

function resumenFrase(b: BorradorPromo, elegidos: PlatoCarta[]): string {
  const valor = parseFloat(b.valorDescuento);
  const cuanto = valor > 0
    ? b.tipoDescuento === 'porcentaje' ? `${valor} % menos` : `S/ ${valor.toFixed(2)} menos por plato`
    : 'un descuento';
  const que = elegidos.length === 0 ? 'los platos que elijas'
    : elegidos.length <= 2 ? elegidos.map((p) => p.nombre).join(' y ')
      : `${elegidos[0].nombre} y ${elegidos.length - 1} platos más`;
  const dias = resumenDias(b.diasSemana).toLowerCase();
  const horario = b.horaInicio && b.horaFin ? `de ${resumenHorario(b)}` : resumenHorario(b).toLowerCase();
  const verbo = elegidos.length === 1 ? 'cuesta' : 'cuestan';
  return `${que.charAt(0).toUpperCase()}${que.slice(1)} ${verbo} ${cuanto}: ${dias}, ${horario}. Se descuenta solo al tomar el pedido.`;
}

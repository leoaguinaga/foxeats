'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, GripVertical, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CategoriaCarta } from '@/lib/types';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { botonCls, inputCls } from '@/components/admin/salon/controles';
import { plural } from './carta';

export function CategoriasPanel({ open, categorias, conteo, sinVincularPor, onClose, onCambio }: {
  open: boolean;
  categorias: CategoriaCarta[];
  conteo: Record<string, number>;
  sinVincularPor: Record<string, number>;
  onClose: () => void;
  onCambio: (cats: CategoriaCarta[]) => void;
}) {
  // Mientras se arrastra se trabaja sobre un borrador; el resto del tiempo manda la lista recibida.
  const [borrador, setBorrador] = useState<CategoriaCarta[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const lista = arrastrando ? borrador : categorias;
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [creando, setCreando] = useState(false);
  const ordenAntes = useRef<string[]>([]);

  async function guardarOrden(nueva: CategoriaCarta[]) {
    const cambios = nueva.map((c, i) => ({ c, orden: i + 1 })).filter(({ c, orden }) => c.orden !== orden);
    if (!cambios.length) return;
    const actualizada = nueva.map((c, i) => ({ ...c, orden: i + 1 }));
    onCambio(actualizada);
    try {
      await Promise.all(cambios.map(({ c, orden }) => api.categorias.update(c.id, { orden })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el orden');
      onCambio(categorias);
    }
  }

  function mover(id: string, dir: -1 | 1) {
    const i = lista.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const nueva = [...lista];
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    guardarOrden(nueva);
  }

  async function actualizar(cat: CategoriaCarta, datos: Partial<CategoriaCarta>) {
    const previa = categorias;
    onCambio(categorias.map((c) => (c.id === cat.id ? { ...c, ...datos } : c)));
    try {
      await api.categorias.update(cat.id, datos);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar la categoría');
      onCambio(previa);
    }
  }

  async function crear() {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      toast.error(`Ya existe la categoría «${nombre}»`);
      return;
    }
    setCreando(true);
    try {
      const orden = Math.max(0, ...categorias.map((c) => c.orden)) + 1;
      const nueva = await api.categorias.create({ nombre, orden, esParaCocina: true, descuentaStock: false });
      onCambio([...categorias, nueva]);
      setNombreNuevo('');
      toast.success(`Categoría «${nombre}» creada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la categoría');
    } finally {
      setCreando(false);
    }
  }

  return (
    <SidePanel open={open} titulo="Categorías" descripcion="El orden es el mismo que ve el mesero al tomar un pedido" onClose={onClose}>
      <ul className="mb-4 overflow-hidden rounded-[9px] border border-[var(--linea)]" aria-label="Categorías de la carta">
        {lista.map((c, i) => {
          const n = conteo[c.id] ?? 0;
          const sv = sinVincularPor[c.id] ?? 0;
          return (
            <li
              key={c.id}
              draggable={renombrando !== c.id}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                ordenAntes.current = categorias.map((x) => x.id);
                setBorrador(categorias);
                setArrastrando(c.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!arrastrando || arrastrando === c.id) return;
                setBorrador((prev) => {
                  const desde = prev.findIndex((x) => x.id === arrastrando);
                  const hasta = prev.findIndex((x) => x.id === c.id);
                  const copia = [...prev];
                  const [item] = copia.splice(desde, 1);
                  copia.splice(hasta, 0, item);
                  return copia;
                });
              }}
              onDragEnd={() => {
                setArrastrando(null);
                if (borrador.map((x) => x.id).join() !== ordenAntes.current.join()) guardarOrden(borrador);
              }}
              className={[
                'grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#EFEDE8] bg-white px-2.5 py-2 last:border-b-0',
                arrastrando === c.id ? 'relative z-10 shadow-[0_10px_24px_-10px_rgba(22,25,34,0.35)] outline outline-[1.5px] outline-[var(--tinta)]' : '',
              ].join(' ')}
            >
              <button
                type="button"
                aria-label={`Mover ${c.nombre}. Usa las flechas arriba y abajo`}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    mover(c.id, e.key === 'ArrowUp' ? -1 : 1);
                    requestAnimationFrame(() => (e.target as HTMLElement).focus());
                  }
                }}
                className="grid h-8 cursor-grab place-items-center rounded text-[#B0ADA4] hover:text-[var(--pizarra)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)] active:cursor-grabbing"
              >
                <GripVertical className="size-4" aria-hidden />
                <span className="sr-only">Posición {i + 1} de {lista.length}</span>
              </button>

              <div className="min-w-0">
                {renombrando === c.id ? (
                  <Renombrar
                    valor={c.nombre}
                    onListo={(nombre) => {
                      setRenombrando(null);
                      if (nombre && nombre !== c.nombre) actualizar(c, { nombre });
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => setRenombrando(c.id)}
                    onKeyDown={(e) => { if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); setRenombrando(c.id); } }}
                    title="Doble clic para renombrar"
                    className="block max-w-full truncate rounded-sm text-left text-[13.5px] font-medium text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"
                  >
                    {c.nombre}
                  </button>
                )}
                <p className="truncate text-xs text-[var(--pizarra)]">
                  {n === 0 ? 'Vacía' : plural(n, 'plato', 'platos')}
                  {sv > 0 && <span className="text-[var(--aviso)]"> · {sv} sin vincular</span>}
                </p>
              </div>

              <div className="flex gap-1">
                <Regla
                  on={c.esParaCocina}
                  icono={<ChefHat className="size-3" strokeWidth={1.9} />}
                  texto="Cocina"
                  ayuda={c.esParaCocina ? 'Sus platos salen en la comanda de cocina' : 'Sus platos no se imprimen en cocina'}
                  onClick={() => actualizar(c, { esParaCocina: !c.esParaCocina })}
                />
                <Regla
                  on={c.descuentaStock}
                  icono={<Package className="size-3" strokeWidth={1.9} />}
                  texto="Stock"
                  ayuda={c.descuentaStock ? 'Cada venta baja el insumo vinculado' : 'No descuenta stock'}
                  onClick={() => actualizar(c, { descuentaStock: !c.descuentaStock })}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mb-4"
        onSubmit={(e) => { e.preventDefault(); crear(); }}
      >
        <label htmlFor="cat-nueva" className="mb-1.5 block text-xs text-[var(--pizarra)]">Nueva categoría</label>
        <div className="flex gap-2">
          <input id="cat-nueva" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Ej. Postres" className={inputCls} />
          <button type="submit" disabled={creando || !nombreNuevo.trim()} className={botonCls}>{creando ? 'Creando…' : 'Agregar'}</button>
        </div>
      </form>

      <p className="text-[12.5px] leading-relaxed text-[var(--pizarra)]">
        <b className="font-semibold text-[var(--ink)]">Cocina</b>: sus platos salen en la comanda de cocina.{' '}
        <b className="font-semibold text-[var(--ink)]">Stock</b>: cada venta baja el insumo vinculado al plato.
        Arrastra <GripVertical className="inline size-3.5 align-[-2px]" aria-hidden /> para ordenar y haz doble clic en un nombre para renombrarlo.
      </p>
    </SidePanel>
  );
}

function Regla({ on, icono, texto, ayuda, onClick }: {
  on: boolean; icono: React.ReactNode; texto: string; ayuda: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={ayuda}
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
        on ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] bg-white text-[#9a9ca6] hover:text-[var(--pizarra)]',
      ].join(' ')}
    >
      {icono}{texto}
    </button>
  );
}

function Renombrar({ valor, onListo }: { valor: string; onListo: (nombre: string | null) => void }) {
  const [texto, setTexto] = useState(valor);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      aria-label="Nuevo nombre de la categoría"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onListo(texto.trim() || null); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onListo(null); }
      }}
      onBlur={() => onListo(texto.trim() || null)}
      className={`${inputCls} h-7 px-2 text-[13.5px]`}
    />
  );
}

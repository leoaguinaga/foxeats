'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Mesa, TipoMesa, Zona } from '@/lib/types';
import { SidePanel } from './SidePanel';
import { Campo, Segmentado, Stepper, botonCls, botonPrimarioCls, inputCls } from './controles';

const MAX_RANGO = 100;

export function AgregarMesasPanel({ open, onClose, zonas, mesas, zonaInicial, onCreadas }: {
  open: boolean;
  onClose: () => void;
  zonas: Zona[];
  mesas: Mesa[];
  zonaInicial: string;
  onCreadas: () => void;
}) {
  if (!open) return null;
  return (
    <Formulario
      key={zonaInicial}
      onClose={onClose}
      zonas={zonas}
      mesas={mesas}
      zonaInicial={zonaInicial}
      onCreadas={onCreadas}
    />
  );
}

function Formulario({ onClose, zonas, mesas, zonaInicial, onCreadas }: {
  onClose: () => void; zonas: Zona[]; mesas: Mesa[]; zonaInicial: string; onCreadas: () => void;
}) {
  const siguiente = (mesas.reduce((m, x) => Math.max(m, x.numero), 0) || 0) + 1;
  const [zonaId, setZonaId] = useState(zonaInicial);
  const [desde, setDesde] = useState(String(siguiente));
  const [hasta, setHasta] = useState(String(siguiente));
  const [tipo, setTipo] = useState<TipoMesa>('mesa');
  const [personas, setPersonas] = useState(4);
  const [guardando, setGuardando] = useState(false);

  const d = parseInt(desde, 10);
  const h = parseInt(hasta, 10);
  const valido = d >= 1 && h >= d && h - d + 1 <= MAX_RANGO;
  const zonaDe = new Map(zonas.map((z) => [z.id, z.nombre]));
  const usados = new Map(mesas.map((m) => [m.numero, m]));
  const rango = valido ? Array.from({ length: h - d + 1 }, (_, i) => d + i) : [];
  const choques = rango.filter((n) => usados.has(n));
  const nuevos = rango.length - choques.length;

  let error = '';
  if (desde && hasta && !valido) {
    error = h < d ? '«Hasta» no puede ser menor que «Desde».' : d < 1 ? 'Los números empiezan en 1.' : `Máximo ${MAX_RANGO} mesas por vez.`;
  }

  async function crear() {
    if (!valido || nuevos === 0) return;
    setGuardando(true);
    try {
      const r = await api.mesas.crearRango({ desde: d, hasta: h, capacidad: personas, zonaId, tipo });
      const que = tipo === 'barra' ? 'puesto' : 'mesa';
      toast.success(r.creadas.length === 1 ? `${tipo === 'barra' ? 'Puesto de barra' : 'Mesa'} ${r.creadas[0].numero} creado${tipo === 'barra' ? '' : 'a'}` : `${r.creadas.length} ${que}s creado${tipo === 'barra' ? 's' : 'as'}`);
      onCreadas();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron crear las mesas');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SidePanel
      open
      titulo="Agregar mesas"
      descripcion="Crea una mesa o varias seguidas en la zona elegida."
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={onClose} className={botonCls}>Cancelar</button>
          <button type="button" onClick={crear} disabled={!valido || nuevos === 0 || guardando} className={botonPrimarioCls}>
            {guardando ? 'Creando…' : tipo === 'barra' ? (nuevos === 1 ? 'Crear 1 puesto' : `Crear ${nuevos} puestos`) : nuevos === 1 ? 'Crear 1 mesa' : `Crear ${nuevos} mesas`}
          </button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); crear(); }}>
        <Campo label="Zona" htmlFor="am-zona">
          <select id="am-zona" value={zonaId} onChange={(e) => setZonaId(e.target.value)} className={inputCls}>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </Campo>
        <Campo
          label="Tipo"
          ayuda={tipo === 'barra' ? 'Taburetes en la barra. El mesero los ve como «Barra 1, 2…»; cada uno conserva su número para las comandas.' : undefined}
        >
          <Segmentado<TipoMesa>
            etiqueta="Tipo"
            value={tipo}
            opciones={[{ value: 'mesa', label: 'Mesas' }, { value: 'barra', label: 'Puestos de barra' }]}
            onChange={(t) => { setTipo(t); setPersonas(t === 'barra' ? 1 : 4); }}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Desde la mesa" htmlFor="am-desde">
            <input
              id="am-desde" type="number" min={1} inputMode="numeric" value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                const n = parseInt(e.target.value, 10);
                if (n && (!parseInt(hasta, 10) || parseInt(hasta, 10) < n)) setHasta(e.target.value);
              }}
              className={inputCls}
            />
          </Campo>
          <Campo label="Hasta la mesa" htmlFor="am-hasta">
            <input id="am-hasta" type="number" min={1} inputMode="numeric" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
          </Campo>
        </div>
        <Campo label={tipo === 'barra' ? 'Personas por puesto' : 'Personas por mesa'}>
          <Stepper etiqueta="personas" value={personas} min={1} max={50} onChange={setPersonas} />
        </Campo>

        {error && <p role="alert" className="text-[13px] text-[var(--alerta)]">{error}</p>}

        {rango.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-[var(--pizarra)]">Se crearán</p>
            <ul className="flex flex-wrap gap-1.5">
              {rango.map((n) => (
                <li
                  key={n}
                  className={[
                    'rounded-md border px-2 py-0.5 text-[13px] font-semibold tabular-nums',
                    usados.has(n)
                      ? 'border-[var(--alerta)]/50 bg-[var(--alerta-tint)] text-[var(--alerta)] line-through'
                      : 'border-[var(--linea)] text-[var(--ink)]',
                  ].join(' ')}
                >
                  {n}
                </li>
              ))}
            </ul>
            {choques.length > 0 && (
              <p className="mt-3 rounded-lg bg-[var(--aviso-tint)] px-3 py-2.5 text-[12.5px] text-[#7a3c08]">
                {choques.length === 1
                  ? `La mesa ${choques[0]} ya existe en ${zonaDe.get(usados.get(choques[0])!.zonaId ?? '') ?? 'otra zona'}.`
                  : `Las mesas ${choques.join(', ')} ya existen.`}
                {nuevos > 0 ? ` Se crearán las otras ${nuevos}.` : ' No hay números nuevos en este rango.'}
              </p>
            )}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </SidePanel>
  );
}

'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, type InsumoStock } from '@/lib/api';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { Campo, botonFantasmaCls, botonPrimarioCls, inputCls } from '@/components/admin/salon/controles';

export function FormInsumo({ abierto, insumo, onClose, onGuardado }: {
  abierto: boolean; insumo: InsumoStock | null; onClose: () => void; onGuardado: () => void;
}) {
  return (
    <SidePanel
      open={abierto}
      titulo={insumo ? 'Editar insumo' : 'Nuevo insumo'}
      descripcion={insumo ? insumo.nombre : 'Lo que compras y cuentas, en la unidad mínima que vendes.'}
      onClose={onClose}
    >
      {abierto && <Formulario key={insumo?.id ?? 'nuevo'} insumo={insumo} onClose={onClose} onGuardado={onGuardado} />}
    </SidePanel>
  );
}

function Formulario({ insumo, onClose, onGuardado }: { insumo: InsumoStock | null; onClose: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(insumo?.nombre ?? '');
  const [unidadMin, setUnidadMin] = useState(insumo?.nombreUnidadMinima ?? 'botella');
  const [unidadCompra, setUnidadCompra] = useState(insumo?.nombreUnidadCompra ?? 'caja');
  const [porCompra, setPorCompra] = useState(String(insumo?.unidadesPorUnidadDeCompra ?? 12));
  const [minimo, setMinimo] = useState(String(insumo?.minimo ?? 0));
  const [inicial, setInicial] = useState('0');
  const [guardando, setGuardando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setIntentado(true);
    if (!nombre.trim()) return;
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      nombreUnidadMinima: unidadMin.trim() || 'unidad',
      nombreUnidadCompra: unidadCompra.trim() || 'paquete',
      unidadesPorUnidadDeCompra: Math.max(1, parseInt(porCompra, 10) || 1),
      minimo: Math.max(0, parseInt(minimo, 10) || 0),
    };
    try {
      if (insumo) await api.insumos.update(insumo.id, datos);
      else await api.insumos.create({ ...datos, stockActual: Math.max(0, parseInt(inicial, 10) || 0) });
      toast.success(insumo ? `«${datos.nombre}» guardado` : `«${datos.nombre}» agregado al stock`);
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el insumo');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4 pt-1">
      <Campo label="Nombre" htmlFor="ins-nombre" ayuda={intentado && !nombre.trim() ? 'Escribe el nombre del insumo' : undefined}>
        <input id="ins-nombre" className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cerveza Pilsen 620 ml" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Unidad mínima" htmlFor="ins-umin" ayuda="Lo que baja con cada venta">
          <input id="ins-umin" className={inputCls} value={unidadMin} onChange={(e) => setUnidadMin(e.target.value)} placeholder="botella, octavo…" />
        </Campo>
        <Campo label="Unidad de compra" htmlFor="ins-ucomp" ayuda="Como llega: pollo, caja…">
          <input id="ins-ucomp" className={inputCls} value={unidadCompra} onChange={(e) => setUnidadCompra(e.target.value)} placeholder="caja" />
        </Campo>
      </div>
      <Campo label={`Unidades mínimas por ${unidadCompra || 'unidad de compra'}`} htmlFor="ins-por" ayuda="Un pollo = 8 octavos; una caja de cerveza = 12 botellas">
        <input id="ins-por" type="number" min={1} className={inputCls} value={porCompra} onChange={(e) => setPorCompra(e.target.value)} />
      </Campo>
      <Campo label="Avisar por debajo de (unidades mínimas)" htmlFor="ins-min" ayuda="0 = sin aviso">
        <input id="ins-min" type="number" min={0} className={inputCls} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
      </Campo>
      {!insumo && (
        <Campo label="Stock inicial (unidades mínimas)" htmlFor="ins-ini" ayuda="Queda registrado como primer movimiento">
          <input id="ins-ini" type="number" min={0} className={inputCls} value={inicial} onChange={(e) => setInicial(e.target.value)} />
        </Campo>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={botonFantasmaCls} onClick={onClose}>Cancelar</button>
        <button type="submit" className={botonPrimarioCls} disabled={guardando}>{guardando ? 'Guardando…' : insumo ? 'Guardar' : 'Crear insumo'}</button>
      </div>
    </form>
  );
}

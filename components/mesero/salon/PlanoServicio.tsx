'use client';

import { useEffect, useRef, useState } from 'react';
import type { Mesa, ReferenciaPlano } from '@/lib/types';

interface Props {
  mesas: Mesa[];
  referencias: ReferenciaPlano[];
  render: (mesa: Mesa, compacto: boolean) => React.ReactNode;
}

const GAP_TABLET = 10;
const GAP_TELEFONO = 6;

/**
 * Plano del salón con su proporción real: las mesas tienen tamaño fijo (el
 * mayor que entra en el ancho), las columnas sin mesas son pasillos al 25 %
 * de una celda, las filas vacías también y las filas que solo tienen
 * referencias (Entrada, Barra…) miden media celda. Si ni con la celda mínima
 * entra, se desplaza en horizontal.
 */
export function PlanoServicio({ mesas, referencias, render }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(
    ...mesas.map((m) => m.colPosicion! + (m.ancho ?? 1)),
    ...referencias.map((r) => r.col + r.ancho),
    1,
  );
  const filas = Math.max(
    ...mesas.map((m) => m.filaPosicion! + 1),
    ...referencias.map((r) => r.fila + (r.alto ?? 1)),
    1,
  );

  const colConMesa = Array.from({ length: cols }, () => false);
  const filaConMesa = Array.from({ length: filas }, () => false);
  const filaConRef = Array.from({ length: filas }, () => false);
  for (const m of mesas) {
    for (let c = m.colPosicion!; c < m.colPosicion! + (m.ancho ?? 1); c++) colConMesa[c] = true;
    filaConMesa[m.filaPosicion!] = true;
  }
  for (const r of referencias) {
    for (let f = r.fila; f < r.fila + (r.alto ?? 1); f++) filaConRef[f] = true;
  }

  const pesoCol = colConMesa.map((x) => (x ? 1 : 0.25));
  const pesoFila = filaConMesa.map((x, i) => (x ? 1 : filaConRef[i] ? 0.5 : 0.25));

  const telefono = ancho > 0 && ancho < 600;
  const gap = telefono ? GAP_TELEFONO : GAP_TABLET;
  const [min, max] = telefono ? [56, 72] : [96, 128];
  const libre = ancho - gap * (cols - 1);
  const celda = ancho ? Math.max(min, Math.min(max, Math.floor(libre / pesoCol.reduce((s, p) => s + p, 0)))) : max;
  const compacto = celda < 80;

  const px = (p: number) => `${Math.round(celda * p)}px`;

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <div
        className="mx-auto grid w-max"
        style={{
          gridTemplateColumns: pesoCol.map(px).join(' '),
          // Las filas de solo referencias no bajan de 32 px para que su texto se lea.
          gridTemplateRows: pesoFila.map((p) => (p === 0.5 ? `${Math.max(32, Math.round(celda * 0.5))}px` : px(p))).join(' '),
          gap,
        }}
      >
        {referencias.map((r) => (
          <div
            key={r.id}
            aria-hidden
            style={{ gridRow: `${r.fila + 1} / span ${r.alto ?? 1}`, gridColumn: `${r.col + 1} / span ${r.ancho}` }}
            className={`flex items-center justify-center overflow-hidden px-2 font-semibold text-[#7A7D88] [background:repeating-linear-gradient(135deg,#F1EFE9_0_6px,#E9E6DE_6px_12px)] ${
              compacto ? 'rounded-lg text-[10.5px]' : 'rounded-[10px] text-[12px]'
            }`}
          >
            <span className="truncate">{r.etiqueta}</span>
          </div>
        ))}
        {mesas.map((m) => (
          <div key={m.id} style={{ gridRow: m.filaPosicion! + 1, gridColumn: `${m.colPosicion! + 1} / span ${m.ancho ?? 1}` }}>
            {render(m, compacto)}
          </div>
        ))}
      </div>
    </div>
  );
}

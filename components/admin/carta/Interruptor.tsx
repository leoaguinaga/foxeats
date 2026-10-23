'use client';

/** Interruptor «Disponible hoy». Área táctil de 44 px aunque el control se vea de 30 px. */
export function Interruptor({ activo, onChange, disabled, etiqueta, textoSi = 'Sí', textoNo = 'Agotado', soloControl }: {
  activo: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  etiqueta: string;
  textoSi?: string;
  textoNo?: string;
  soloControl?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={[
        'group -my-2 inline-flex min-h-11 items-center gap-2 rounded-md py-2 text-[12.5px] transition-colors disabled:pointer-events-none disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
        activo ? 'text-[var(--ink)]' : 'font-medium text-[var(--aviso)]',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-150',
          activo ? 'bg-[var(--ok)] group-hover:bg-[var(--ok-hover)]' : 'bg-[#CFCDC6] group-hover:bg-[#BFBDB5]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-[2px] size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-150 ease-out',
            activo ? 'left-[14px]' : 'left-[2px]',
          ].join(' ')}
        />
      </span>
      {!soloControl && <span>{activo ? textoSi : textoNo}</span>}
    </button>
  );
}

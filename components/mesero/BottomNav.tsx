'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Bell } from 'lucide-react';
import { api } from '@/lib/api';

const TABS = [
  { href: '/mesero',         label: 'Mesas',   Icon: LayoutGrid },
  { href: '/mesero/carta',   label: 'Carta',   Icon: BookOpen   },
  { href: '/mesero/monitor', label: 'Monitor', Icon: Bell       },
];

/** Rondas listas para servir, para que Monitor avise sin tener que abrirlo. */
function useListos() {
  const [listos, setListos] = useState(0);
  useEffect(() => {
    const leer = () =>
      api.monitor.get().then((r) => setListos(r.filter((x) => x.estado === 'listo').length)).catch(() => {});
    leer();
    const id = setInterval(leer, 10000);
    return () => clearInterval(id);
  }, []);
  return listos;
}

export function BottomNav() {
  const pathname = usePathname();
  const listos = useListos();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--linea)] bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        const badge = href === '/mesero/monitor' && listos > 0 ? listos : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={badge ? `${label}, ${badge} ronda${badge !== 1 ? 's' : ''} lista${badge !== 1 ? 's' : ''}` : undefined}
            className={[
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--tinta)]',
              active ? 'text-[var(--tinta)] font-semibold' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {active && <span aria-hidden className="absolute top-0 left-1/2 h-[3px] w-9 -translate-x-1/2 rounded-b-[3px] bg-[var(--aji)]" />}
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.1 : 1.9} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-[var(--ok)] px-1 text-center text-[10.5px] leading-4 font-bold text-white tabular-nums">
                  {badge}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Bell } from 'lucide-react';

const TABS = [
  { href: '/mesero',         label: 'Mesas',   Icon: LayoutGrid },
  { href: '/mesero/carta',   label: 'Carta',   Icon: BookOpen   },
  { href: '/mesero/monitor', label: 'Monitor', Icon: Bell       },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-white">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={[
              'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors',
              active
                ? 'text-[var(--alerta)]'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.2 : 1.7}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

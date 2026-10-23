'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Settings, House, LayoutGrid, BookOpen, Package, Tag, Wallet, Users, Printer, Menu, X, LogOut, MonitorSmartphone, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { api, type LocalConfig } from '@/lib/api';
import { signOut, useSession } from '@/lib/auth-client';
import { AdminPulseProvider, useAdminPulse } from './admin-pulse';

type Señal = 'agotados' | 'ticketeras';

interface NavItem { href: string; label: string; icon: LucideIcon; señal?: Señal }

const NAV: Array<{ grupo: string; items: NavItem[] }> = [
  {
    grupo: 'Servicio', items: [
      { href: '/admin', label: 'Inicio', icon: House },
      { href: '/admin/mesas', label: 'Salón', icon: LayoutGrid },
    ]
  },
  {
    grupo: 'Carta', items: [
      { href: '/admin/catalogo', label: 'Carta', icon: BookOpen },
      { href: '/admin/stock', label: 'Stock', icon: Package, señal: 'agotados' },
      { href: '/admin/promociones', label: 'Promociones', icon: Tag },
    ]
  },
  {
    grupo: 'Caja y equipo', items: [
      { href: '/admin/turnos', label: 'Caja', icon: Wallet },
      { href: '/admin/usuarios', label: 'Staff', icon: Users },
    ]
  },
  {
    grupo: 'Sistema', items: [
      { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
      { href: '/admin/ticketeras', label: 'Ticketeras', icon: Printer, señal: 'ticketeras' },
    ]
  },
];

const ITEMS = NAV.flatMap((g) => g.items);
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'FoxEats';

function esActivo(href: string, pathname: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminPulseProvider>
      <ShellInterior>{children}</ShellInterior>
    </AdminPulseProvider>
  );
}

function ShellInterior({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [cajon, setCajon] = useState(false);
  const actual = ITEMS.find((i) => esActivo(i.href, pathname));

  // Cierra el cajón móvil al navegar y con Escape
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la ruta
  useEffect(() => { setCajon(false); }, [pathname]);
  useEffect(() => {
    if (!cajon) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCajon(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cajon]);

  return (
    <div className="min-h-screen bg-[var(--piedra)] md:grid md:grid-cols-[68px_minmax(0,1fr)] lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* Barra móvil */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--tinta)] px-4 py-3 text-white md:hidden">
        <button
          type="button"
          onClick={() => setCajon(true)}
          aria-label="Abrir menú"
          aria-expanded={cajon}
          className="-ml-1 rounded-md p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--aji)]"
        >
          <Menu className="size-5" />
        </button>
        <Marca compacta />
        <span className="flex-1 truncate text-sm font-semibold">{actual?.label ?? 'Administración'}</span>
        <ChipTurno compacto />
      </header>

      {/* Riel lateral (tablet: iconos; escritorio: completo) */}
      <aside className="sticky top-0 hidden h-screen md:flex">
        <Riel />
      </aside>

      {/* Cajón móvil */}
      {cajon && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú de administración">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setCajon(false)}
            className="absolute inset-0 bg-[var(--ink)]/45 animate-in fade-in duration-150"
          />
          <div className="relative flex h-full w-[264px] animate-in slide-in-from-left duration-200 ease-out">
            <Riel completo onCerrar={() => setCajon(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        {/* Cada página pone su propio título; la cabecera solo sitúa el día y la caja. */}
        <header className="hidden items-center justify-between gap-6 border-b border-[var(--linea)] px-8 py-3 md:flex">
          <p className="text-[13px] text-[var(--pizarra)] first-letter:uppercase">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <ChipTurno />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  const [config, setConfig] = useState<LocalConfig | null>(null);
  useEffect(() => {
    let active = true;
    api.admin.settings().then((data) => { if (active) setConfig(data); }).catch(() => { });
    const update = (event: Event) => setConfig((event as CustomEvent<LocalConfig>).detail);
    window.addEventListener('local-config-updated', update);
    return () => { active = false; window.removeEventListener('local-config-updated', update); };
  }, []);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <img src={config?.logo || "/brand/foxeats/icono-fondo-terracota.png"} className='size-9 shrink-0 rounded-lg object-contain bg-card' alt="" />
      {!compacta && (
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-[14.5px] font-semibold">FoxEats</b>
          <span className="block truncate text-xs text-white/60">{config?.nombre || STORE_NAME}</span>
        </div>
      )}
    </div>
  );
}

function Riel({ completo = false, onCerrar }: { completo?: boolean; onCerrar?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const { insumosAgotados, insumosPorReponer, ticketerasCaidas } = useAdminPulse();

  // En tablet el riel solo muestra iconos, salvo cuando es el cajón móvil.
  const etiqueta = completo ? '' : 'md:hidden lg:inline';
  const bloque = completo ? '' : 'md:hidden lg:block';
  const nombre = data?.user?.name ?? '';
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'AD';

  const señal = (s?: Señal) => {
    if (s === 'agotados' && insumosAgotados.length + insumosPorReponer.length > 0) {
      const n = insumosAgotados.length + insumosPorReponer.length;
      return { tipo: 'conteo' as const, texto: String(n), titulo: `${insumosAgotados.length} agotados · ${insumosPorReponer.length} por reponer` };
    }
    if (s === 'ticketeras' && ticketerasCaidas.length > 0) {
      return { tipo: 'punto' as const, texto: '', titulo: 'Ticketera sin conexión' };
    }
    return null;
  };

  return (
    <div className="flex w-full flex-col overflow-y-auto bg-[var(--tinta)] px-3 py-4 text-white">
      <div className={['flex items-center justify-between px-2 pb-5', completo ? '' : 'md:justify-center md:px-0 lg:justify-between lg:px-2'].join(' ')}>
        <div className={completo ? '' : 'hidden lg:block'}><Marca /></div>
        {!completo && <div className="lg:hidden"><Marca compacta /></div>}
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar menú" className="rounded-md p-1.5 hover:bg-white/10">
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Administración" className="flex flex-col">
        {NAV.map(({ grupo, items }, gi) => (
          <div key={grupo} className={gi > 0 ? 'mt-4' : ''}>
            <p className={['px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.07em] text-white/45 uppercase', bloque].join(' ')}>
              {grupo}
            </p>
            {!completo && gi > 0 && <div className="mx-3 mb-3 hidden border-t border-white/10 md:block lg:hidden" />}
            <ul className="flex flex-col gap-0.5">
              {items.map(({ href, label, icon: Icon, señal: s }) => {
                const activo = esActivo(href, pathname);
                const sg = señal(s);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={activo ? 'page' : undefined}
                      title={sg ? `${label} · ${sg.titulo}` : label}
                      className={[
                        'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--aji)]',
                        completo ? '' : 'md:justify-center lg:justify-start',
                        activo
                          ? 'bg-white/12 text-white shadow-[inset_3px_0_0_var(--aji)]'
                          : 'text-white/75 hover:bg-white/7 hover:text-white',
                      ].join(' ')}
                    >
                      <Icon className="size-[17px] shrink-0" strokeWidth={1.9} aria-hidden />
                      <span className={etiqueta}>{label}</span>
                      {sg?.tipo === 'conteo' && (
                        <span className={[
                          'ml-auto rounded-full bg-[var(--aji)] px-1.5 text-[11px] font-semibold text-[var(--ink)] tabular-nums',
                          completo ? '' : 'md:absolute md:top-0.5 md:right-1 lg:static',
                        ].join(' ')}>
                          {sg.texto}
                        </span>
                      )}
                      {sg?.tipo === 'punto' && (
                        <span className={[
                          'ml-auto size-2 rounded-full bg-[var(--alerta)] ring-3 ring-[var(--alerta)]/30',
                          completo ? '' : 'md:absolute md:top-1.5 md:right-2 lg:static',
                        ].join(' ')} />
                      )}
                      {sg && <span className="sr-only">{sg.titulo}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Cambiar a la vista de cajero (el backend acepta administración en caja) */}
      <Link
        href="/caja"
        title="Vista de cajero"
        className={[
          'mt-auto mb-3 flex items-center gap-2.5 rounded-lg border border-white/15 px-2.5 py-2 text-sm font-medium text-white/85 transition-colors duration-150',
          'hover:border-[var(--aji)]/60 hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--aji)]',
          completo ? '' : 'md:justify-center lg:justify-start',
        ].join(' ')}
      >
        <MonitorSmartphone className="size-[17px] shrink-0" strokeWidth={1.9} aria-hidden />
        <span className={etiqueta}>Vista de cajero</span>
        <ArrowRight className={['ml-auto size-3.5 text-white/50', etiqueta].join(' ')} aria-hidden />
      </Link>

      <div className={['flex items-center gap-2.5 border-t border-white/12 px-2 pt-4', completo ? '' : 'md:flex-col md:px-0 lg:flex-row lg:px-2'].join(' ')}>
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/14 text-xs font-semibold" title={nombre}>
          {iniciales}
        </div>
        <div className={['min-w-0 flex-1 leading-tight', bloque].join(' ')}>
          <b className="block truncate text-[13px] font-semibold">{nombre}</b>
          <span className="block text-[11.5px] text-white/55">Administrador</span>
        </div>
        <button
          type="button"
          onClick={async () => { await signOut(); router.push('/login'); }}
          title="Salir"
          className="flex items-center gap-1.5 rounded-md border border-white/22 px-2 py-1 text-xs text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--aji)]"
        >
          <LogOut className="size-3.5" aria-hidden />
          <span className={etiqueta}>Salir</span>
          <span className="sr-only">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ChipTurno({ compacto = false }: { compacto?: boolean }) {
  const { turnos, turnoAbierto } = useAdminPulse();
  if (turnos === null) return null;

  if (compacto) {
    return (
      <Link href="/admin/turnos" className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-white/80">
        <span className={['size-2 rounded-full', turnoAbierto ? 'bg-[var(--ok)]' : 'bg-white/40'].join(' ')} />
        {turnoAbierto ? 'Caja abierta' : 'Caja cerrada'}
      </Link>
    );
  }

  return (
    <Link
      href="/admin/turnos"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--linea)] bg-white py-1.5 pr-3.5 pl-2.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--tinta)]/40"
    >
      <span className={['size-2 rounded-full', turnoAbierto ? 'bg-[var(--ok)]' : 'bg-[var(--pizarra)]/50'].join(' ')} />
      {turnoAbierto
        ? <>Caja abierta · {turnoAbierto.cajeroNombre} · desde {hora(turnoAbierto.fechaApertura)}</>
        : 'Caja cerrada'}
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { signOut, useSession, type Rol } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function CajaLayout({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const router = useRouter();
  const esAdmin = (data?.user as { role?: Rol } | undefined)?.role === 'administracion';
  const [nombre, setNombre] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.admin.brand().then((b) => { if (active) setNombre(b.nombre); }).catch(() => { });
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--piedra)]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[var(--tinta)] px-4 py-2.5 text-white md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/brand/foxeats/icono-fondo-terracota.png" className="size-8 shrink-0 rounded-lg" alt="" />
          <span className="truncate font-semibold">Caja{nombre && ` · ${nombre}`}</span>
          {esAdmin && (
            <span className="hidden shrink-0 rounded-full bg-[var(--aji)] px-2 py-px text-[11px] font-semibold text-[var(--ink)] sm:inline">
              Vista de cajero
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-sm text-white/70 md:inline">{data?.user?.name}</span>
          {esAdmin && (
            <Link
              href="/admin"
              aria-label="Volver a administración"
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[var(--tinta)] transition-colors hover:bg-[var(--aji-tint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">Volver a administración</span>
            </Link>
          )}
          <button
            type="button"
            onClick={async () => { await signOut(); router.push('/login'); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-2.5 py-1.5 text-[13px] text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--aji)]"
          >
            <LogOut className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Salir</span>
            <span className="sr-only sm:hidden">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#161922', color: '#FFFFFF', borderRadius: '10px' },
          success: { iconTheme: { primary: '#25835A', secondary: '#FFFFFF' } },
          error:   { iconTheme: { primary: '#C2362B', secondary: '#FFFFFF' } },
        }}
      />
    </div>
  );
}

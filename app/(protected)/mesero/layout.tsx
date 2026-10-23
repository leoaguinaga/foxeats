'use client';

import { signOut, useSession } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { iniciales } from '@/components/mesero/salon/servicio';
import { Toaster } from 'react-hot-toast';
import { BottomNav } from '@/components/mesero/BottomNav';

export default function MeseroLayout({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // En la vista de mesa individual no mostramos el bottom nav para ganar espacio
  const showBottomNav = !pathname.startsWith('/mesero/mesa/');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--piedra)]">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--tinta)] px-4 py-2.5 text-white md:px-6">
        <div className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[var(--aji)] text-[12.5px] font-bold select-none text-[var(--ink)]">
          FE
        </div>
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{process.env.NEXT_PUBLIC_STORE_NAME || 'FoxEats'}</span>

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 py-1 text-[13.5px] text-white/85 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--aji)] [&::-webkit-details-marker]:hidden">
            <span className="grid size-7 place-items-center rounded-full bg-white/14 text-[11.5px] font-semibold text-white">
              {iniciales(data?.user?.name ?? '')}
            </span>
            <span className="hidden sm:inline">{data?.user?.name}</span>
            <ChevronDown className="size-3.5 opacity-70 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
          </summary>
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white py-1 text-[var(--ink)] shadow-[0_12px_30px_-12px_rgba(22,25,34,.35)]">
            <p className="truncate border-b border-[var(--linea)] px-3 pt-1.5 pb-2 text-[12.5px] text-[var(--pizarra)]">{data?.user?.name}</p>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] font-medium hover:bg-[var(--piedra)]"
            >
              <LogOut className="size-4" strokeWidth={1.9} aria-hidden />Cerrar sesión
            </button>
          </div>
        </details>
      </header>

      {/* Padding inferior para que el contenido no quede bajo el bottom nav */}
      <main className={showBottomNav ? 'flex-1 pb-16' : 'flex-1'}>
        {children}
      </main>

      {showBottomNav && <BottomNav />}

      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#161922', color: '#FFFFFF', borderRadius: '10px' },
          success: { iconTheme: { primary: '#25835A', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#C2362B', secondary: '#FFFFFF' } },
        }}
      />
    </div>
  );
}

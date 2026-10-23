'use client';

import { signOut, useSession } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 bg-[var(--tinta)] text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--aji)] text-sm font-bold select-none text-[var(--ink)]">
            FE
          </div>
          <span className="font-semibold tracking-wide">{process.env.NEXT_PUBLIC_STORE_NAME || "FoxEats"}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">{data?.user?.name}</span>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
          >
            Salir
          </Button>
        </div>
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

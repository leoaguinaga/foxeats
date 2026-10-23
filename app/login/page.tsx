'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { signIn, useSession, homeForRole, type Rol } from '@/lib/auth-client';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'FoxEats';

function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // La hora se pinta solo en el cliente para no desalinear el HTML del servidor
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return now;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: sessionData, isPending: sessionPending } = useSession();
  const now = useClock();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirigir si ya existe una sesión activa
  useEffect(() => {
    if (!sessionPending && sessionData?.user) {
      const role = (sessionData.user as { role?: Rol }).role;
      if (role) {
        router.replace(homeForRole(role));
      }
    }
  }, [sessionData, sessionPending, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn.email({ email, password });

      if (result?.error) {
        setPassword('');
        setError({
          title: 'El correo o la contraseña no coinciden.',
          detail: 'Revisa las mayúsculas o pídele a administración que restablezca tu contraseña.',
        });
        setLoading(false);
        return;
      }

      if (!result?.data?.user) {
        setError({
          title: 'No se pudo iniciar sesión.',
          detail: 'Vuelve a intentarlo en unos segundos.',
        });
        setLoading(false);
        return;
      }

      const role = (result.data.user as { role?: Rol }).role;
      window.location.href = role ? homeForRole(role) : '/';
    } catch {
      setError({
        title: 'No hay conexión con el servidor del local.',
        detail: 'Revisa que el equipo del servidor esté encendido y vuelve a intentarlo.',
      });
      setLoading(false);
    }
  }

  function trackCapsLock(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--';
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const date = now?.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="flex-1 grid grid-rows-[auto_1fr] md:grid-rows-none md:grid-cols-[5fr_7fr] min-h-dvh">
      {/* Panel de marca: en celular se reduce a una franja */}
      <section className="bg-[var(--tinta)] text-white flex md:flex-col md:justify-between items-center md:items-start gap-3 px-5 py-4 md:p-10 lg:p-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/foxeats/logo-horizontal-crema.png"
          alt={STORE_NAME}
          className="h-8 md:h-10 w-auto"
        />

        <div className="hidden md:grid gap-2">
          <p className="text-7xl lg:text-8xl font-medium leading-none tracking-tighter tabular-nums">
            {hh}<span className="text-[var(--aji)]">:</span>{mm}
          </p>
          <p className="text-base text-white/75 first-letter:uppercase min-h-6">{date}</p>
        </div>

        <p className="hidden md:block text-sm text-white/60">Sistema operativo del restaurante</p>
      </section>

      <section className="grid justify-items-center content-start md:content-center px-5 py-8 md:px-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm grid gap-6">
          <div className="grid gap-1">
            <h1 className="text-2xl md:text-[1.75rem] font-semibold tracking-tight text-[var(--ink)] text-balance">
              Ingresa a tu turno
            </h1>
            <p className="text-sm text-muted-foreground">
              Usa el correo y la contraseña que te dio administración.
            </p>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-muted-foreground tracking-wide">
              Correo
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nombre@foxeats.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-13 w-full rounded-[10px] border border-input bg-white px-3.5 text-base text-[var(--ink)] placeholder:text-[#9A9CA5] outline-none transition focus:border-[var(--tinta)] focus:ring-3 focus:ring-[var(--tinta-tint)]"
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-muted-foreground tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                className={[
                  'h-13 w-full rounded-[10px] border bg-white pl-3.5 pr-24 text-base text-[var(--ink)] outline-none transition focus:ring-3',
                  error
                    ? 'border-[var(--alerta)] focus:ring-[var(--alerta-tint)]'
                    : 'border-input focus:border-[var(--tinta)] focus:ring-[var(--tinta-tint)]',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1.5 h-10 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {capsLock && (
              <p className="text-xs font-medium text-[var(--aviso)]">Bloq Mayús está activado</p>
            )}
          </div>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="flex gap-2.5 rounded-[10px] bg-[var(--alerta-tint)] px-3.5 py-3 text-sm leading-snug text-[var(--alerta)]"
            >
              <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
              <p>
                <strong className="block font-semibold text-[var(--ink)]">{error.title}</strong>
                {error.detail}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-13.5 items-center justify-center gap-2.5 rounded-[10px] bg-[var(--tinta)] text-base font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]/40"
          >
            {loading && (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            )}
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="text-[0.8125rem] text-muted-foreground">
            ¿Olvidaste tu contraseña? Pídele a administración que la restablezca.
          </p>
        </form>
      </section>
    </main>
  );
}

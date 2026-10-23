'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Upload, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, type LocalConfig } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { Campo, inputCls, botonCls, botonPrimarioCls } from '@/components/admin/salon/controles';

export default function ConfiguracionPage() {
  const { data: session } = useSession();
  const [saved, setSaved] = useState<LocalConfig | null>(null);
  const [draft, setDraft] = useState<LocalConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const data = await api.admin.settings(); setSaved(data); setDraft(data); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración'); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del formulario desde la API
  useEffect(() => { void load(); }, [load]);

  async function logo(file?: File) {
    if (!file || !draft) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 250 * 1024) {
      setError('Elige una imagen PNG, JPG o WebP de hasta 250 KB.'); return;
    }
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const image = new Image(); image.src = value; await image.decode();
      setDraft({ ...draft, logo: value }); setError('');
    } catch { setError('No se pudo leer esa imagen. Elige otro archivo.'); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft) return; setBusy(true); setError('');
    try {
      const data = await api.admin.updateSettings(draft); setSaved(data); setDraft(data);
      window.dispatchEvent(new CustomEvent('local-config-updated', { detail: data }));
      toast.success('Datos del local guardados');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setBusy(false); }
  }
  const dirty = saved && draft && ['nombre', 'logo', 'direccion', 'telefono'].some((key) => saved[key as keyof LocalConfig] !== draft[key as keyof LocalConfig]);

  return <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-6">
    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Configuración</h1>
    <p className="mt-0.5 text-[13px] text-[var(--pizarra)]">La identidad de tu local y tus datos personales.</p>
    <div className="mt-6 max-w-4xl space-y-6">
      <section aria-labelledby="local-heading" className="rounded-[10px] border border-[var(--linea)] bg-white">
        <div className="border-b border-[var(--linea)] px-5 py-4"><h2 id="local-heading" className="font-semibold">Datos del local</h2><p className="mt-1 text-[13px] text-[var(--pizarra)]">El nombre y el logo identifican tu local en administración.</p></div>
        {!draft ? <div className="p-5">{error ? <><p role="alert" className="mb-3 text-sm text-[var(--alerta)]">{error}</p><button className={botonCls} onClick={load}>Reintentar</button></> : <p role="status" className="text-sm text-[var(--pizarra)]">Cargando configuración…</p>}</div> :
        <form onSubmit={save}>
          <fieldset disabled={busy} className="space-y-5 p-5 disabled:opacity-70">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--linea)] bg-[var(--piedra)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen local de tamaño acotado */}
                {draft.logo ? <img src={draft.logo} alt="Logo del local" className="size-full object-contain p-1" /> : <Store className="size-7 text-[var(--pizarra)]" aria-hidden />}
              </div>
              <div className="space-y-2"><label className={`${botonCls} relative cursor-pointer overflow-hidden focus-within:outline-2 focus-within:outline-[var(--tinta)]`}><Upload className="size-4" aria-hidden />{draft.logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" aria-label="Subir logo del local" accept="image/png,image/jpeg,image/webp" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { void logo(e.target.files?.[0]); e.target.value = ''; }} /></label>
                {draft.logo && <button type="button" className="ml-3 text-[13px] text-[var(--pizarra)] underline underline-offset-4" onClick={() => setDraft({ ...draft, logo: null })}>Quitar logo</button>}
                <p className="text-xs text-[var(--pizarra)]">PNG, JPG o WebP. Máximo 250 KB.</p>
              </div>
            </div>
            <Campo label="Nombre del local" htmlFor="local-name"><input id="local-name" required maxLength={100} className={inputCls} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} /></Campo>
            <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
              <Campo label="Dirección (opcional)" htmlFor="local-address"><input id="local-address" autoComplete="street-address" maxLength={240} className={inputCls} value={draft.direccion} onChange={(e) => setDraft({ ...draft, direccion: e.target.value })} /></Campo>
              <Campo label="Teléfono (opcional)" htmlFor="local-phone"><input id="local-phone" type="tel" autoComplete="tel" maxLength={40} className={inputCls} value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} /></Campo>
            </div>
            {error && <p role="alert" className="text-sm text-[var(--alerta)]">{error}</p>}
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--linea)] px-5 py-3"><p className="text-xs text-[var(--pizarra)]">{dirty ? 'Tienes cambios sin guardar.' : 'Los cambios guardados se comparten con administración.'}</p><button className={botonPrimarioCls} disabled={busy || !dirty || !draft.nombre.trim()}>{busy ? 'Guardando…' : 'Guardar datos del local'}</button></div>
        </form>}
      </section>
      {session?.user && <Perfil key={session.user.id} id={session.user.id} name={session.user.name} email={session.user.email} />}
      <Link href="/admin/usuarios" className="flex items-center justify-between gap-4 rounded-[10px] border border-[var(--linea)] bg-white px-5 py-4 hover:bg-[var(--tinta-tint)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"><span><span className="block text-sm font-semibold">Nombres del equipo</span><span className="mt-1 block text-[13px] text-[var(--pizarra)]">Abre una persona en Staff para editar su nombre.</span></span><ArrowRight className="size-4 shrink-0" aria-hidden /></Link>
    </div>
  </div>;
}

function Perfil({ id, name, email }: { id: string; name: string; email: string }) {
  const { refetch } = useSession();
  const [nombre, setNombre] = useState(name);
  const [saved, setSaved] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.admin.updateUsuario(id, { name: nombre.trim() }); setSaved(nombre.trim()); setNombre(nombre.trim()); await refetch(); toast.success('Tu nombre se actualizó'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="profile-heading" className="rounded-[10px] border border-[var(--linea)] bg-white"><div className="border-b border-[var(--linea)] px-5 py-4"><h2 id="profile-heading" className="font-semibold">Mi perfil</h2><p className="mt-1 break-all text-[13px] text-[var(--pizarra)]">{email} · Administración</p></div><form onSubmit={save} className="space-y-4 p-5"><Campo label="Tu nombre" htmlFor="profile-name"><input id="profile-name" autoComplete="name" required maxLength={100} disabled={busy} className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>{error && <p role="alert" className="text-sm text-[var(--alerta)]">{error}</p>}<button className={botonPrimarioCls} disabled={busy || !nombre.trim() || nombre.trim() === saved}>{busy ? 'Guardando…' : 'Guardar mi nombre'}</button></form></section>;
}

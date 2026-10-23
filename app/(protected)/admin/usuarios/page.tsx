'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ChevronRight, ShieldCheck, Wallet, ConciergeBell, KeyRound, Copy, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { api, UsuarioAdmin } from '@/lib/api';
import { useSession, type Rol } from '@/lib/auth-client';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import {
  botonCls, botonPrimarioCls, botonFantasmaCls, inputCls, Campo, Segmentado,
} from '@/components/admin/salon/controles';

const ROLES: Array<{ value: Rol; label: string; ayuda: string; icon: LucideIcon }> = [
  { value: 'mesero',         label: 'Mesero',         ayuda: 'Toma pedidos en el salón y envía rondas a cocina.', icon: ConciergeBell },
  { value: 'cajero',         label: 'Cajero',         ayuda: 'Abre y cierra caja, cobra cuentas y registra gastos.', icon: Wallet },
  { value: 'administracion', label: 'Administración', ayuda: 'Acceso completo: carta, salón, staff y caja.',       icon: ShieldCheck },
];

const ROL_LABEL: Record<string, string> = { administracion: 'Administración', cajero: 'Cajero', mesero: 'Mesero' };

type Filtro = 'todos' | Rol;

const VACIO = { name: '', email: '', password: '', role: 'mesero' as Rol };

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function fechaAlta(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsuariosPage() {
  const { data: sesion } = useSession();
  const miId = sesion?.user?.id;

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [alta, setAlta] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);

  const fetchUsuarios = useCallback(async () => {
    try {
      setUsuarios(await api.admin.listUsuarios());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const lista = useMemo(() => {
    const orden: Record<string, number> = { administracion: 0, cajero: 1, mesero: 2 };
    return [...(usuarios ?? [])]
      .filter((u) => filtro === 'todos' || u.role === filtro)
      .sort((a, b) =>
        Number(b.activo !== false) - Number(a.activo !== false)
        || (orden[a.role] ?? 9) - (orden[b.role] ?? 9)
        || a.name.localeCompare(b.name, 'es'));
  }, [usuarios, filtro]);

  const cuenta = (r: Rol) => (usuarios ?? []).filter((u) => u.role === r).length;
  const activos = (usuarios ?? []).filter((u) => u.activo !== false).length;

  function actualizarLocal(u: UsuarioAdmin) {
    setUsuarios((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? prev);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Staff</h1>
          <p className="mt-0.5 text-[13px] text-[var(--pizarra)] tabular-nums">
            {usuarios === null
              ? 'Cargando equipo…'
              : `${usuarios.length} persona${usuarios.length !== 1 ? 's' : ''} · ${activos} con acceso`}
          </p>
        </div>
        <button type="button" onClick={() => setAlta(true)} className={botonPrimarioCls}>
          <Plus className="size-3.5" aria-hidden /> Nuevo usuario
        </button>
      </div>

      {usuarios && usuarios.length > 0 && (
        <div className="mt-5 overflow-x-auto [scrollbar-width:none]">
          <Segmentado<Filtro>
            etiqueta="Filtrar por rol"
            value={filtro}
            onChange={setFiltro}
            opciones={[
              { value: 'todos', label: `Todos · ${usuarios.length}` },
              ...ROLES.map((r) => ({ value: r.value, label: `${r.label} · ${cuenta(r.value)}` })),
            ]}
          />
        </div>
      )}

      <section aria-label="Equipo" className="mt-4 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
        {usuarios === null && !error && (
          <ul aria-busy className="divide-y divide-[var(--linea)]">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="size-9 rounded-full bg-[var(--muted)]" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 rounded bg-[var(--muted)]" />
                  <div className="h-2.5 w-48 rounded bg-[var(--muted)]" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && usuarios === null && (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-sm text-[var(--ink)]">No se pudo cargar el equipo. Revisa que el servidor esté en marcha.</p>
            <button type="button" onClick={fetchUsuarios} className={botonCls}>Reintentar</button>
          </div>
        )}

        {usuarios && lista.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-[var(--pizarra)]">
              {filtro === 'todos' ? 'Todavía no hay nadie en el equipo.' : `No hay ningún ${ROL_LABEL[filtro].toLowerCase()} registrado.`}
            </p>
          </div>
        )}

        {usuarios && lista.length > 0 && (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px_120px_28px] gap-4 border-b border-[var(--linea)] bg-[var(--piedra)]/60 px-4 py-2 text-[11.5px] font-medium text-[var(--pizarra)] md:grid">
              <span>Persona</span><span>Rol</span><span>Estado</span><span>Alta</span><span />
            </div>
            <ul className="divide-y divide-[var(--linea)]">
              {lista.map((u) => {
                const activo = u.activo !== false;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setEditando(u)}
                      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-[var(--tinta-tint)]/50 focus-visible:bg-[var(--tinta-tint)]/60 focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_150px_110px_120px_28px]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={[
                          'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
                          activo ? 'bg-[var(--tinta)] text-white' : 'bg-[var(--muted)] text-[var(--pizarra)]',
                        ].join(' ')} aria-hidden>
                          {iniciales(u.name)}
                        </span>
                        <span className="min-w-0">
                          <span className={['block truncate text-sm font-medium', activo ? 'text-[var(--ink)]' : 'text-[var(--pizarra)]'].join(' ')}>
                            {u.name}
                            {u.id === miId && <span className="ml-1.5 text-xs font-normal text-[var(--pizarra)]">(tú)</span>}
                          </span>
                          <span className="block truncate text-[12.5px] text-[var(--pizarra)]">{u.email}</span>
                        </span>
                      </span>
                      <span className="hidden text-[13px] text-[var(--ink)] md:block">{ROL_LABEL[u.role] ?? u.role}</span>
                      <span className="justify-self-end md:justify-self-start">
                        <EstadoPill activo={activo} />
                      </span>
                      <span className="hidden text-[13px] text-[var(--pizarra)] tabular-nums md:block">{fechaAlta(u.createdAt)}</span>
                      <ChevronRight className="hidden size-4 text-[var(--pizarra)]/60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink)] md:block" aria-hidden />
                      <span className="col-span-2 pl-12 text-[12.5px] text-[var(--pizarra)] md:hidden">{ROL_LABEL[u.role] ?? u.role}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <AltaPanel
        open={alta}
        onClose={() => setAlta(false)}
        onCreado={() => { setAlta(false); fetchUsuarios(); }}
        emailsUsados={(usuarios ?? []).map((u) => u.email.toLowerCase())}
      />

      <EditarPanel
        usuario={editando}
        esYo={editando?.id === miId}
        onClose={() => setEditando(null)}
        onGuardado={(u) => { actualizarLocal(u); setEditando(null); }}
      />
    </div>
  );
}

function EstadoPill({ activo }: { activo: boolean }) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[11.5px] font-semibold',
      activo ? 'bg-[var(--ok-tint)] text-[var(--ok)]' : 'bg-[var(--muted)] text-[var(--pizarra)]',
    ].join(' ')}>
      <span className={['size-1.5 rounded-full', activo ? 'bg-[var(--ok)]' : 'bg-[var(--pizarra)]/60'].join(' ')} />
      {activo ? 'Activo' : 'Sin acceso'}
    </span>
  );
}

function SelectorRol({ value, onChange }: { value: Rol; onChange: (r: Rol) => void }) {
  return (
    <div role="radiogroup" aria-label="Rol" className="space-y-2">
      {ROLES.map(({ value: v, label, ayuda, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={[
              'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
              on ? 'border-[var(--tinta)] bg-[var(--tinta-tint)]' : 'border-[var(--linea)] hover:border-[var(--tinta)]/40',
            ].join(' ')}
          >
            <Icon className={['mt-0.5 size-4 shrink-0', on ? 'text-[var(--tinta)]' : 'text-[var(--pizarra)]'].join(' ')} strokeWidth={1.9} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
              <span className="block text-[12.5px] leading-snug text-[var(--pizarra)]">{ayuda}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AltaPanel({ open, onClose, onCreado, emailsUsados }: {
  open: boolean;
  onClose: () => void;
  onCreado: () => void;
  emailsUsados: string[];
}) {
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof typeof VACIO | 'general', string>>>({});
  const [guardando, setGuardando] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el formulario al abrir
  useEffect(() => { if (open) { setForm(VACIO); setErrores({}); } }, [open]);

  function validar() {
    const e: typeof errores = {};
    if (!form.name.trim()) e.name = 'Escribe el nombre.';
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Escribe un correo válido.';
    else if (emailsUsados.includes(email)) e.email = 'Ya hay alguien con este correo.';
    if (form.password.length < 8) e.password = 'Usa al menos 8 caracteres.';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function crear(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    try {
      await api.admin.crearUsuario({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      toast.success(`${form.name.trim()} ya puede entrar`);
      onCreado();
    } catch (err) {
      setErrores({ general: err instanceof Error ? err.message : 'No se pudo crear el usuario.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SidePanel
      open={open}
      titulo="Nuevo usuario"
      descripcion="Entrará con su correo y la contraseña que pongas aquí."
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={onClose} className={botonFantasmaCls}>Cancelar</button>
          <button type="submit" form="alta-usuario" disabled={guardando} className={botonPrimarioCls}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </>
      }
    >
      <form id="alta-usuario" onSubmit={crear} noValidate className="space-y-4">
        <Campo label="Nombre" htmlFor="u-nombre">
          <input id="u-nombre" className={inputCls} placeholder="Ana García" value={form.name}
            aria-invalid={!!errores.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {errores.name && <p className="text-xs text-[var(--alerta)]">{errores.name}</p>}
        </Campo>
        <Campo label="Correo" htmlFor="u-email">
          <input id="u-email" type="email" autoComplete="off" className={inputCls} placeholder="ana@foxeats.local" value={form.email}
            aria-invalid={!!errores.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {errores.email && <p className="text-xs text-[var(--alerta)]">{errores.email}</p>}
        </Campo>
        <Campo label="Contraseña" htmlFor="u-pass" ayuda={errores.password ? undefined : 'Mínimo 8 caracteres. Compártela en persona.'}>
          <input id="u-pass" type="password" autoComplete="new-password" className={inputCls} value={form.password}
            aria-invalid={!!errores.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {errores.password && <p className="text-xs text-[var(--alerta)]">{errores.password}</p>}
        </Campo>
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--pizarra)]">Rol</p>
          <SelectorRol value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </div>
        {errores.general && (
          <p role="alert" className="rounded-lg bg-[var(--alerta-tint)] px-3 py-2 text-[13px] text-[var(--alerta)]">{errores.general}</p>
        )}
      </form>
    </SidePanel>
  );
}

function EditarPanel({ usuario, esYo, onClose, onGuardado }: {
  usuario: UsuarioAdmin | null;
  esYo: boolean;
  onClose: () => void;
  onGuardado: (u: UsuarioAdmin) => void;
}) {
  const { refetch } = useSession();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('mesero');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- copia el usuario elegido al borrador
  useEffect(() => { if (usuario) { setNombre(usuario.name); setRol(usuario.role as Rol); setActivo(usuario.activo !== false); } }, [usuario]);

  if (!usuario) return null;
  const sinCambios = nombre.trim() === usuario.name && rol === usuario.role && activo === (usuario.activo !== false);

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      await api.admin.updateUsuario(usuario.id, { name: nombre.trim(), ...(esYo ? {} : { role: rol, activo }) });
      if (esYo) await refetch();
      onGuardado({ ...usuario, name: nombre.trim(), role: rol, activo });
      toast.success(`${usuario.name} actualizado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SidePanel
      open
      titulo={usuario.name}
      descripcion={usuario.email}
      onClose={onClose}
      pie={
        <>
          <button type="button" onClick={onClose} className={botonFantasmaCls}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={sinCambios || guardando || !nombre.trim()} className={botonPrimarioCls}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Campo label="Nombre" htmlFor="editar-nombre">
          <input id="editar-nombre" className={inputCls} value={nombre} maxLength={100} disabled={guardando} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--pizarra)]">Rol</p>
          {esYo ? (
            <p className="rounded-lg bg-[var(--piedra)] px-3 py-2.5 text-[13px] text-[var(--pizarra)]">
              Eres {ROL_LABEL[usuario.role]?.toLowerCase()}. Otra persona de administración debe cambiar tu rol.
            </p>
          ) : (
            <SelectorRol value={rol} onChange={setRol} />
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-[var(--pizarra)]">Acceso</p>
          <label className={[
            'flex items-start justify-between gap-4 rounded-lg border border-[var(--linea)] px-3 py-2.5',
            esYo ? 'opacity-60' : 'cursor-pointer',
          ].join(' ')}>
            <span>
              <span className="block text-sm font-semibold text-[var(--ink)]">Puede entrar al sistema</span>
              <span className="block text-[12.5px] leading-snug text-[var(--pizarra)]">
                {esYo ? 'No puedes quitarte el acceso a ti mismo.' : 'Si lo apagas, su sesión deja de funcionar y no podrá volver a entrar.'}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={activo}
              disabled={esYo}
              onChange={(e) => setActivo(e.target.checked)}
              className="peer sr-only"
            />
            <span aria-hidden className={[
              'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--tinta)]',
              activo ? 'bg-[var(--ok)]' : 'bg-[var(--pizarra)]/35',
            ].join(' ')}>
              <span className={['absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left] duration-150', activo ? 'left-[18px]' : 'left-0.5'].join(' ')} />
            </span>
          </label>
        </div>

        {!esYo && <RestablecerPassword key={usuario.id} usuario={usuario} />}

        <p className="text-xs text-[var(--pizarra)]">Alta: {fechaAlta(usuario.createdAt)}</p>
      </div>
    </SidePanel>
  );
}

// Sin 0/O ni 1/l/I para que se pueda dictar sin confusiones.
function generarPassword() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

function RestablecerPassword({ usuario }: { usuario: UsuarioAdmin }) {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [lista, setLista] = useState<string | null>(null);

  function abrir() {
    setPassword(generarPassword());
    setVisible(true);
    setError('');
    setLista(null);
    setAbierto(true);
  }

  async function restablecer(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (password.length < 8) { setError('Usa al menos 8 caracteres.'); return; }
    setGuardando(true);
    setError('');
    try {
      await api.admin.restablecerPassword(usuario.id, password);
      setLista(password);
      setAbierto(false);
      toast.success(`Contraseña de ${usuario.name} restablecida`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--pizarra)]">Contraseña</p>
      <div className="rounded-lg border border-[var(--linea)] px-3 py-2.5">
        {lista ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ink)]">Nueva contraseña lista</p>
            <p className="text-[12.5px] leading-snug text-[var(--pizarra)]">
              Compártela en persona. Sus sesiones abiertas se cerraron y deberá entrar con esta.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-[var(--piedra)] px-2.5 py-1.5 font-mono text-sm tracking-wide text-[var(--ink)]">{lista}</code>
              <button type="button" onClick={() => copiar(lista)} className={botonCls} aria-label="Copiar contraseña">
                <Copy className="size-3.5" aria-hidden />
              </button>
            </div>
            <button type="button" onClick={() => setLista(null)} className="text-[12.5px] font-medium text-[var(--tinta)] hover:underline">
              Listo
            </button>
          </div>
        ) : abierto ? (
          <form onSubmit={restablecer} noValidate className="space-y-2.5">
            <Campo label="Nueva contraseña" htmlFor="reset-pass" ayuda={error ? undefined : 'Mínimo 8 caracteres. Cerrará sus sesiones abiertas.'}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="reset-pass"
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${inputCls} pr-9 font-mono`}
                    value={password}
                    maxLength={128}
                    disabled={guardando}
                    aria-invalid={!!error}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute inset-y-0 right-0 grid w-9 place-items-center text-[var(--pizarra)] hover:text-[var(--ink)]"
                    aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
                <button type="button" onClick={() => { setPassword(generarPassword()); setVisible(true); setError(''); }} disabled={guardando} className={botonCls}>
                  Generar
                </button>
              </div>
              {error && <p className="text-xs text-[var(--alerta)]">{error}</p>}
            </Campo>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} disabled={guardando} className={botonFantasmaCls}>Cancelar</button>
              <button type="submit" disabled={guardando} className={botonPrimarioCls}>
                {guardando ? 'Restableciendo…' : 'Restablecer'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <span className="text-[12.5px] leading-snug text-[var(--pizarra)]">
              ¿Olvidó su contraseña? Ponle una nueva y compártela en persona.
            </span>
            <button type="button" onClick={abrir} className={`${botonCls} shrink-0`}>
              <KeyRound className="size-3.5" aria-hidden /> Restablecer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

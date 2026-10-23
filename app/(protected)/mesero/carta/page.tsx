'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PlatoCarta, CategoriaCarta } from '@/lib/types';
import { Search } from 'lucide-react';

export default function CartaPage() {
  const [platos, setPlatos] = useState<PlatoCarta[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState<'todas' | string>('todas');

  const fetchPlatos = useCallback(async () => {
    try {
      const [platosData, catData] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/platos`, { credentials: 'include' }).then((r) => r.json()),
        api.categorias.list().catch(() => []),
      ]);
      if (Array.isArray(platosData)) setPlatos(platosData);
      if (Array.isArray(catData)) setCategorias(catData);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    fetchPlatos();
    const id = setInterval(fetchPlatos, 10000);
    return () => clearInterval(id);
  }, [fetchPlatos]);

  async function handleToggle(plato: PlatoCarta) {
    setToggling(plato.id);
    try {
      await api.menu.toggleDisponible(plato.id, !plato.disponible);
      setPlatos((prev) => prev.map((p) => (p.id === plato.id ? { ...p, disponible: !p.disponible } : p)));
      toast.success(!plato.disponible ? `"${plato.nombre}" disponible` : `"${plato.nombre}" sin stock`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally { setToggling(null); }
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando carta…</div>;

  const PlatoCard = ({ plato }: { plato: PlatoCarta }) => (
    <div className={['flex items-center justify-between rounded-xl border bg-white px-4 py-3 transition-opacity', !plato.disponible ? 'opacity-50' : ''].join(' ')}>
      <div>
        <p className={['font-medium text-sm', !plato.disponible ? 'line-through text-muted-foreground' : ''].join(' ')}>
          {plato.nombre}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">S/{plato.precio}</span>
          {plato.quedan !== null && (
            <span className={['text-xs font-medium', plato.quedan <= 0 ? 'text-[var(--alerta)]' : 'text-[var(--ok)]'].join(' ')}>
              {plato.quedan <= 0 ? 'Agotado' : plato.quedan === 1 ? 'queda 1' : `quedan ${plato.quedan}`}
            </span>
          )}
        </div>
      </div>
      {plato.quedan === null && <button
        onClick={() => handleToggle(plato)}
        disabled={toggling === plato.id}
        className={['rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
          plato.disponible ? 'bg-[var(--alerta-tint)] text-[var(--alerta)] hover:bg-[var(--alerta-tint-strong)]'
                           : 'bg-[var(--ok-tint)] text-[var(--ok)] hover:bg-[var(--ok-tint-strong)]',
        ].join(' ')}
      >
        {plato.disponible ? 'No hay' : 'Hay'}
      </button>}
    </div>
  );

  const Section = ({ label, items }: { label: string; items: PlatoCarta[] }) => {
    if (!items.length) return null;
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{label}</h3>
        <div className="space-y-2">
          {items.map((p) => <PlatoCard key={p.id} plato={p} />)}
        </div>
      </section>
    );
  };

  const q = busqueda.trim().toLowerCase();
  const platosFiltrados = platos.filter((p) => {
    if (filtroCat !== 'todas' && p.categoriaId !== filtroCat && p.categoria?.id !== filtroCat) return false;
    if (q && !p.nombre.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-[var(--ink)]">Carta</h2>
        <span className="text-xs text-muted-foreground">{platos.filter((p) => !p.disponible).length} sin stock</span>
      </div>

      <div className="flex items-center gap-2 sticky top-0 z-10 bg-[var(--piedra)] py-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar plato…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tinta)]"
          />
        </div>
        <select
          value={filtroCat}
          onChange={(e) => setFiltroCat(e.target.value)}
          className="h-10 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tinta)]"
        >
          <option value="todas">Todas</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
          ))}
        </select>
      </div>

      {platosFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Ningún plato coincide con la búsqueda.</p>
      ) : (
        <div className="space-y-6">
          {categorias.map((cat) => (
            <Section
              key={cat.id}
              label={cat.nombre}
              items={platosFiltrados.filter((p) => p.categoriaId === cat.id || p.categoria?.id === cat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

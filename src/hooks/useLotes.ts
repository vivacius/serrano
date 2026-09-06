import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LoteDB } from '../types/lote';

const CACHE_KEY = 'amaranta_lotes_cache';

function getLocalCache(): Map<string, LoteDB> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveLocalCache(map: Map<string, LoteDB>) {
  try {
    const obj = Object.fromEntries(map.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
  }
}

function cleanPayload(updates: Partial<LoteDB>): Partial<LoteDB> {
  const cleaned: Record<string, unknown> = { ...updates };

  // Date fields: Postgres rejects "" for DATE types. Convert "" to null
  if ('fecha_sep' in cleaned) {
    cleaned.fecha_sep = cleaned.fecha_sep ? cleaned.fecha_sep : null;
  }
  if ('fecha_venta' in cleaned) {
    cleaned.fecha_venta = cleaned.fecha_venta ? cleaned.fecha_venta : null;
  }

  // Numeric fields: convert "" or NaN to null
  if ('precio' in cleaned) {
    if (cleaned.precio === '' || cleaned.precio === null || cleaned.precio === undefined) {
      cleaned.precio = null;
    } else {
      const num = Number(cleaned.precio);
      cleaned.precio = isNaN(num) ? null : num;
    }
  }

  // Text fields: trim whitespace and convert empty strings to null
  const textFields = ['propietario', 'documento', 'telefono', 'vendedor', 'observacion'];
  textFields.forEach(field => {
    if (field in cleaned) {
      const val = cleaned[field];
      cleaned[field] = typeof val === 'string' && val.trim() ? val.trim() : null;
    }
  });

  return cleaned as Partial<LoteDB>;
}

export function useLotes() {
  const [lotes, setLotes] = useState<Map<string, LoteDB>>(() => getLocalCache());
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    // ── Initial load from Supabase ─────────────────────────
    const fetchAll = async () => {
      try {
        const { data, error: err } = await supabase
          .from('lotes')
          .select('*');

        if (err) {
          console.warn('Supabase fetch notice:', err.message);
          setError(err.message);
        } else if (data && data.length > 0) {
          const map = new Map<string, LoteDB>(data.map(l => [l.id_lote, l as LoteDB]));
          setLotes(map);
          saveLocalCache(map);
        }
      } catch (err: unknown) {
        console.warn('Error fetching lotes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    // ── Realtime subscription ────────────────────────────
    const channel = supabase
      .channel('lotes_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lotes' },
        (payload) => {
          const updated = (payload.new || payload.old) as LoteDB;
          if (updated && updated.id_lote) {
            setLotes(prev => {
              const next = new Map(prev);
              const cur = next.get(updated.id_lote) || ({} as LoteDB);
              next.set(updated.id_lote, { ...cur, ...updated });
              saveLocalCache(next);
              return next;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Supabase Realtime status:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Update a lote ──────────────────────────────────────
  const updateLote = useCallback(
    async (id_lote: string, updates: Partial<LoteDB>) => {
      const payload = cleanPayload(updates);

      // 1. Optimistic local & cache update
      setLotes(prev => {
        const next = new Map(prev);
        const cur  = next.get(id_lote) || { id_lote, estado: 'DISPONIBLE' } as LoteDB;
        next.set(id_lote, { ...cur, ...payload, updated_at: new Date().toISOString() });
        saveLocalCache(next);
        return next;
      });

      // 2. Try Supabase upsert
      try {
        const { error: err } = await supabase
          .from('lotes')
          .upsert({
            id_lote,
            ...payload,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id_lote' });

        if (err) {
          console.error('Supabase error:', err.message);
          return { error: err.message };
        }
        return { error: null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error de conexión';
        return { error: msg };
      }
    },
    []
  );

  return { lotes, loading, error, updateLote };
}

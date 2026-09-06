// ── Lote states ──────────────────────────────────────────
export type LoteEstado = 'DISPONIBLE' | 'SEPARADO' | 'VENDIDO';
export type UserRole   = 'admin' | 'comisionista';

// ── User profile (Supabase table: profiles) ───────────────
export interface UserProfile {
  id:         string;
  email:      string | null;
  nombre:     string | null;
  rol:        UserRole;
  activo:     boolean;
  created_at: string;
}

// ── Database record (Supabase table: lotes) ───────────────
export interface LoteDB {
  id_lote:     string;
  estado:      LoteEstado;
  propietario: string | null;
  documento:   string | null;
  telefono:    string | null;
  precio:      number | null;
  vendedor:    string | null;
  observacion: string | null;
  fecha_sep:   string | null;
  fecha_venta: string | null;
  updated_at:  string | null;
  updated_by:  string | null;
}

// ── GeoJSON feature properties ────────────────────────────
export interface LoteGeoProps {
  id_lote:    string;
  numero:     number;
  nombre:     string;
  area_plano: number;
  area_geom:  number;
  calidad:    string;
  latitud:    number;
  longitud:   number;
}

// ── Combined selected lote (geo + db) ─────────────────────
export interface LoteSelected {
  properties: LoteGeoProps;
  db:         LoteDB | null;
}

// ── Visual config per estado ──────────────────────────────
export const ESTADO_CONFIG: Record<LoteEstado, {
  label: string;
  icon: string;
  color: string;
  fillColor: string;
  fillOpacity: number;
  weight: number;
}> = {
  DISPONIBLE: {
    label: 'Disponible',
    icon: '🟢',
    color: '#16a34a',
    fillColor: '#22c55e',
    fillOpacity: 0.22,
    weight: 1.5,
  },
  SEPARADO: {
    label: 'Separado',
    icon: '🟡',
    color: '#d97706',
    fillColor: '#f59e0b',
    fillOpacity: 0.42,
    weight: 2,
  },
  VENDIDO: {
    label: 'Vendido',
    icon: '🔴',
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 0.52,
    weight: 2,
  },
};

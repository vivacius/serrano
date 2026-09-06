import React, { useState, useMemo } from 'react';
import { LoteDB, LoteEstado, LoteGeoProps, LoteSelected, UserRole } from '../types/lote';

// ── Sidebar ────────────────────────────────────────────────
interface SidebarProps {
  lotes:         Map<string, LoteDB>;
  selectedLote:  LoteSelected | null;
  role:          UserRole;
  showLabels:    boolean;
  activeFilter:  LoteEstado[];
  gpsWatching:   boolean;
  gpsError:      string | null;
  isOpen:        boolean;
  onCollapse:    () => void;
  onToggleLabels:    () => void;
  onFilterChange:    (f: LoteEstado[]) => void;
  onGpsToggle:       () => void;
  onEditLote:        () => void;
  onCloseLote:       () => void;
  onSearchResult:    (numero: number | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lotes, selectedLote, role,
  showLabels, activeFilter,
  gpsWatching, gpsError,
  isOpen, onCollapse,
  onToggleLabels, onFilterChange, onGpsToggle,
  onEditLote, onCloseLote, onSearchResult,
}) => {
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const s = { DISPONIBLE: 0, SEPARADO: 0, VENDIDO: 0 };
    lotes.forEach(l => { s[l.estado]++; });
    return s;
  }, [lotes]);

  const canEdit = role === 'admin';

  const toggleFilter = (e: LoteEstado) => {
    if (activeFilter.includes(e)) {
      if (activeFilter.length === 1) return;
      onFilterChange(activeFilter.filter(x => x !== e));
    } else {
      onFilterChange([...activeFilter, e]);
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    const num = parseInt(val, 10);
    onSearchResult(isNaN(num) ? null : num);
  };

  return (
    <aside className={`sidebar${isOpen ? '' : ' collapsed'}`}>

      {/* ── Sidebar header with collapse button ── */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/logo_sin_fondo.png" alt="Serrano Inmobiliaria" className="sidebar-brand-img" />
          <span>Panel de control</span>
        </div>
        <button
          className="btn-icon sidebar-close-btn"
          onClick={onCollapse}
          title="Cerrar panel"
        >
          ✕
        </button>
      </div>

      <div className="sidebar-scroll">

        {/* ── Search ── */}
        <div className="sidebar-section">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="number"
              placeholder="Buscar lote por número..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              min={1} max={99}
            />
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="sidebar-section">
          <p className="sidebar-section-title">Resumen</p>
          <div className="stats-grid">
            <div className="stat-card disponible">
              <div className="stat-num">{stats.DISPONIBLE}</div>
              <div className="stat-label">Disponibles</div>
            </div>
            <div className="stat-card separado">
              <div className="stat-num">{stats.SEPARADO}</div>
              <div className="stat-label">Separados</div>
            </div>
            <div className="stat-card vendido">
              <div className="stat-num">{stats.VENDIDO}</div>
              <div className="stat-label">Vendidos</div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="sidebar-section">
          <p className="sidebar-section-title">Mostrar en mapa</p>
          <div className="filter-chips">
            {(['DISPONIBLE', 'SEPARADO', 'VENDIDO'] as LoteEstado[]).map(e => (
              <button
                key={e}
                className={`chip ${e === 'DISPONIBLE' ? 'disp' : e === 'SEPARADO' ? 'sep' : 'vend'} ${activeFilter.includes(e) ? 'active' : ''}`}
                onClick={() => toggleFilter(e)}
              >
                {e === 'DISPONIBLE' ? '🟢 Disponible' : e === 'SEPARADO' ? '🟡 Separado' : '🔴 Vendido'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Capas ── */}
        <div className="sidebar-section">
          <p className="sidebar-section-title">Capas</p>
          <div className="layer-toggle">
            <label htmlFor="toggle-labels">🔢 Números de lote</label>
            <label className="toggle-switch">
              <input
                id="toggle-labels"
                type="checkbox"
                checked={showLabels}
                onChange={onToggleLabels}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* ── GPS ── */}
        <div className="sidebar-section">
          <p className="sidebar-section-title">Mi ubicación</p>
          <button
            className={`gps-btn ${gpsWatching ? 'active' : ''}`}
            onClick={onGpsToggle}
          >
            <span className="gps-dot" />
            {gpsWatching ? '📍 GPS activo — Detener' : '📍 Activar mi ubicación'}
          </button>
          {gpsError && (
            <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
              ⚠️ {gpsError}
            </p>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="sidebar-section">
          <p className="sidebar-section-title">Leyenda</p>
          {[
            { color: '#22c55e', label: 'Disponible para venta' },
            { color: '#f59e0b', label: 'Separado / En proceso' },
            { color: '#ef4444', label: 'Vendido / Escriturado' },
          ].map(({ color, label }) => (
            <div key={label} className="legend-item">
              <div className="legend-dot" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>

      </div>

      {/* ── Selected lote detail card ── */}
      {selectedLote && (
        <LoteDetailCard
          lote={selectedLote}
          db={lotes.get(selectedLote.properties.id_lote) || null}
          canEdit={canEdit}
          onEdit={onEditLote}
          onClose={onCloseLote}
        />
      )}
    </aside>
  );
};

// ── Lote detail card ──────────────────────────────────────
interface LoteDetailCardProps {
  lote:    LoteSelected;
  db:      LoteDB | null;
  canEdit: boolean;
  onEdit:  () => void;
  onClose: () => void;
}

const LoteDetailCard: React.FC<LoteDetailCardProps> = ({
  lote, db, canEdit, onEdit, onClose,
}) => {
  const estado = db?.estado || 'DISPONIBLE';
  const { properties: p } = lote;

  return (
    <div className="lote-detail-card">
      <div className="lote-detail-header">
        <div>
          <h3>{p.nombre}</h3>
          <span className={`lote-estado-badge ${estado}`}>
            {estado === 'DISPONIBLE' ? '🟢' : estado === 'SEPARADO' ? '🟡' : '🔴'} {estado}
          </span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Cerrar">✕</button>
      </div>

      <div className="lote-detail-rows">
        <div className="lote-detail-row">
          <span className="dl">Área plano</span>
          <span className="dv">{p.area_plano.toLocaleString()} m²</span>
        </div>
        <div className="lote-detail-row">
          <span className="dl">Área real</span>
          <span className="dv">{p.area_geom.toFixed(1)} m²</span>
        </div>
        <div className="lote-detail-row">
          <span className="dl">ID</span>
          <span className="dv" style={{ fontFamily: 'monospace' }}>{p.id_lote}</span>
        </div>
        <div className="lote-detail-row">
          <span className="dl">Propietario</span>
          <span className="dv">{db?.propietario ? db.propietario : <em style={{ opacity: 0.6 }}>Sin asignar</em>}</span>
        </div>
        {db?.precio && (
          <div className="lote-detail-row">
            <span className="dl">Precio</span>
            <span className="dv">${db.precio.toLocaleString()}</span>
          </div>
        )}
        {db?.observacion && (
          <div className="lote-detail-row">
            <span className="dl">Nota</span>
            <span className="dv" style={{ maxWidth: 140, textAlign: 'right' }}>{db.observacion}</span>
          </div>
        )}
      </div>

      {canEdit && (
        <button className="btn-edit-lote" onClick={onEdit}>
          ✏️ Modificar estado y dueño
        </button>
      )}
    </div>
  );
};

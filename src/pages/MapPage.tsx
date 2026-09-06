import React, { useState, useCallback } from 'react';
import { useAuth, formatUserDisplay } from '../hooks/useAuth';
import { useLotes } from '../hooks/useLotes';
import { useGeolocation } from '../hooks/useGeolocation';
import { LoteDB, LoteEstado, LoteGeoProps, LoteSelected } from '../types/lote';
import { Sidebar } from '../components/Sidebar';
import MapView from '../components/MapView';
import LoteModal from '../components/LoteModal';
import { UsersModal } from '../components/UsersModal';

const MapPage: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { lotes, loading, updateLote } = useLotes();
  const geo = useGeolocation();

  const [selectedLote,    setSelectedLote]    = useState<LoteSelected | null>(null);
  const [showModal,       setShowModal]       = useState(false);
  const [showUsersModal,  setShowUsersModal]  = useState(false);
  const [showLabels,      setShowLabels]      = useState(true);
  const [activeFilter,    setActiveFilter]    = useState<LoteEstado[]>(['DISPONIBLE', 'SEPARADO', 'VENDIDO']);
  const [searchLote,      setSearchLote]      = useState<number | null>(null);
  const [sidebarOpen,     setSidebarOpen]     = useState(() => window.innerWidth > 768);

  const isAdmin = role === 'admin';

  const handleLoteClick = useCallback((props: LoteGeoProps, db: LoteDB | null) => {
    setSelectedLote({ properties: props, db });
  }, []);

  const handleEditLote = useCallback((props: LoteGeoProps, db: LoteDB | null) => {
    if (role !== 'admin') return; // Comisionista cannot edit
    setSelectedLote({ properties: props, db });
    setShowModal(true);
  }, [role]);

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const handleSave = async (updates: Partial<LoteDB>): Promise<{ error: string | null }> => {
    if (!selectedLote) return { error: 'No hay lote seleccionado' };
    const { error: err } = await updateLote(selectedLote.properties.id_lote, updates);
    if (!err) {
      // Refresh selectedLote with new db data
      setSelectedLote(prev => prev
        ? { ...prev, db: { ...(prev.db || {} as LoteDB), ...updates } as LoteDB }
        : null
      );
      return { error: null };
    }
    return { error: err };
  };

  return (
    <div className="map-layout">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <img src="/logo_sin_fondo.png" alt="Serrano Inmobiliaria" className="header-brand-img" />
          <div>
            <h1>Condominio Amaranta</h1>
            <span>Visor de lotes</span>
          </div>
        </div>
        <div className="header-right">
          {isAdmin && (
            <button
              className="btn-users-management"
              onClick={() => setShowUsersModal(true)}
              title="Administrar usuarios y roles"
            >
              👥 Usuarios
            </button>
          )}
          <div className="header-user">
            <span>👤 {formatUserDisplay(user?.email)}</span>
            <span className={`role-badge ${role}`}>
              {isAdmin ? '👑 Admin' : '💼 Comisionista'}
            </span>
          </div>
          <button className="btn-signout" onClick={signOut}>Salir</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="map-body">

        {/* Mobile backdrop overlay */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — collapse button is now INSIDE the sidebar header */}
        <div className="sidebar-wrapper">
          <Sidebar
            lotes={lotes}
            selectedLote={selectedLote}
            role={role}
            showLabels={showLabels}
            activeFilter={activeFilter}
            gpsWatching={geo.watching}
            gpsError={geo.error}
            isOpen={sidebarOpen}
            onCollapse={() => setSidebarOpen(false)}
            onToggleLabels={() => setShowLabels(v => !v)}
            onFilterChange={setActiveFilter}
            onGpsToggle={geo.toggle}
            onEditLote={() => setShowModal(true)}
            onCloseLote={() => setSelectedLote(null)}
            onSearchResult={setSearchLote}
          />
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {!sidebarOpen && (
            <button
              className="sidebar-open-fab"
              onClick={handleOpenSidebar}
              title="Abrir panel de control"
            >
              ☰ <span>Panel</span>
            </button>
          )}

          {loading ? (
            <div className="map-loading">
              <div className="loading-spinner" />
              Cargando lotes...
            </div>
          ) : (
            <MapView
              lotes={lotes}
              showLabels={showLabels}
              activeFilter={activeFilter}
              geoLocation={geo.location}
              searchLote={searchLote}
              role={role}
              onLoteClick={handleLoteClick}
              onEditLote={handleEditLote}
              onOpenSidebar={handleOpenSidebar}
            />
          )}
        </div>
      </div>

      {/* ── Edit Lote Modal ── */}
      {showModal && selectedLote && isAdmin && (
        <LoteModal
          lote={selectedLote}
          role={role}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Admin Users Management Modal ── */}
      {showUsersModal && isAdmin && (
        <UsersModal
          currentUserEmail={user?.email}
          onClose={() => setShowUsersModal(false)}
        />
      )}
    </div>
  );
};

export default MapPage;

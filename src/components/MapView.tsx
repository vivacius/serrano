import React, { useEffect, useRef } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { FeatureCollection, Feature, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import geojsonData from '../data/lotes.json';
import { LoteDB, LoteEstado, LoteGeoProps, ESTADO_CONFIG, UserRole } from '../types/lote';
import { GeoLocation } from '../hooks/useGeolocation';

// Fix Leaflet default icon URLs (broken with Vite bundler)
import iconUrl       from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ── Tile layer URLs ────────────────────────────────────────
const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS    = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

// ── GeoJSON bounding box & precomputed centers ─────────────
const typedGeoData = geojsonData as unknown as FeatureCollection;
const geoLayer = L.geoJSON(typedGeoData as unknown as GeoJsonObject);
const BOUNDS   = geoLayer.getBounds();
const CENTER   = BOUNDS.getCenter();

// Precompute centers ONCE at module load to avoid 99x geometric calculations on every render
const LOTE_CENTERS: Record<string, L.LatLng> = {};
typedGeoData.features.forEach((f: Feature) => {
  const id = f.properties?.id_lote;
  if (id) {
    LOTE_CENTERS[id] = L.geoJSON(f as GeoJsonObject).getBounds().getCenter();
  }
});

// ── Price formatter helper ────────────────────────────────
const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// ── HTML generator for custom popup ───────────────────────
function buildPopupContent(
  props: LoteGeoProps,
  db: LoteDB | null,
  canEdit: boolean,
  onEdit: () => void,
  onOpenSidebar: () => void
): HTMLElement {
  const estado = (db?.estado || 'DISPONIBLE') as LoteEstado;
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.DISPONIBLE;

  const container = document.createElement('div');
  container.className = 'lote-popup-card';

  container.innerHTML = `
    <div class="lote-popup-header">
      <div>
        <h4 class="lote-popup-title">${props.nombre}</h4>
        <span class="lote-popup-id">${props.id_lote}</span>
      </div>
      <span class="lote-popup-badge ${estado}">
        ${cfg.icon} ${cfg.label}
      </span>
    </div>

    <div class="lote-popup-body">
      <div class="lote-popup-row">
        <span class="lote-popup-label">📐 Área:</span>
        <span class="lote-popup-val"><strong>${props.area_plano.toLocaleString()} m²</strong></span>
      </div>
      <div class="lote-popup-row">
        <span class="lote-popup-label">👤 Dueño:</span>
        <span class="lote-popup-val">${db?.propietario ? `<strong>${db.propietario}</strong>` : '<em style="opacity:0.65">Sin asignar (Disponible)</em>'}</span>
      </div>
      ${db?.precio ? `
        <div class="lote-popup-row highlight">
          <span class="lote-popup-label">💰 Precio:</span>
          <span class="lote-popup-val price">${priceFormatter.format(db.precio)}</span>
        </div>
      ` : ''}
      ${db?.telefono ? `
        <div class="lote-popup-row">
          <span class="lote-popup-label">📱 Teléfono:</span>
          <span class="lote-popup-val">${db.telefono}</span>
        </div>
      ` : ''}
      ${db?.vendedor ? `
        <div class="lote-popup-row">
          <span class="lote-popup-label">🤝 Asesor:</span>
          <span class="lote-popup-val">${db.vendedor}</span>
        </div>
      ` : ''}
      ${db?.observacion ? `
        <div class="lote-popup-note">
          <span class="note-label">📝</span> ${db.observacion}
        </div>
      ` : ''}
    </div>

    <div class="lote-popup-actions">
      ${canEdit ? '<button class="btn-popup-edit" type="button">✏️ Modificar estado y dueño</button>' : ''}
      <button class="btn-popup-panel" type="button">📋 Ver en panel</button>
    </div>
  `;

  // Attach button events
  const editBtn = container.querySelector('.btn-popup-edit');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onEdit();
    });
  }

  const panelBtn = container.querySelector('.btn-popup-panel');
  if (panelBtn) {
    panelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenSidebar();
    });
  }

  return container;
}

// ── Inner map component (uses useMap) ─────────────────────
interface MapContentProps {
  lotes:         Map<string, LoteDB>;
  showLabels:    boolean;
  activeFilter:  LoteEstado[];
  geoLocation:   GeoLocation | null;
  searchLote:    number | null;
  role:          UserRole;
  onLoteClick:   (props: LoteGeoProps, db: LoteDB | null) => void;
  onEditLote:    (props: LoteGeoProps, db: LoteDB | null) => void;
  onOpenSidebar: () => void;
}

const MapContent: React.FC<MapContentProps> = ({
  lotes, showLabels, activeFilter, geoLocation, searchLote, role,
  onLoteClick, onEditLote, onOpenSidebar,
}) => {
  const map = useMap();

  const baseLayerRef     = useRef<L.TileLayer | null>(null);
  const labelsLayerRef   = useRef<L.TileLayer | null>(null);
  const loteLabelGrpRef  = useRef<L.LayerGroup | null>(null);
  const gpsGroupRef      = useRef<L.LayerGroup | null>(null);
  const featureLayersRef = useRef<Map<string, L.Path>>(new Map());

  // Keep latest references for event callbacks without re-triggering layer recreations
  const callbacksRef = useRef({ onLoteClick, onEditLote, onOpenSidebar });
  useEffect(() => {
    callbacksRef.current = { onLoteClick, onEditLote, onOpenSidebar };
  });

  const lotesRef = useRef(lotes);
  useEffect(() => {
    lotesRef.current = lotes;
  }, [lotes]);

  const activeFilterRef = useRef(activeFilter);
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  // ── 1. Base tile layers (Mount ONCE) ───────────────────
  useEffect(() => {
    baseLayerRef.current = L.tileLayer(ESRI_SATELLITE, {
      attribution: 'Esri World Imagery',
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(map);

    labelsLayerRef.current = L.tileLayer(ESRI_LABELS, {
      attribution: '',
      maxZoom: 21,
      maxNativeZoom: 19,
      opacity: 0.7,
    }).addTo(map);

    map.fitBounds(BOUNDS, { padding: [30, 30] });

    return () => {
      baseLayerRef.current   && map.removeLayer(baseLayerRef.current);
      labelsLayerRef.current && map.removeLayer(labelsLayerRef.current);
    };
  }, [map]);

  // ── 2. Lotes GeoJSON layer (Mount ONCE, zero re-renders) ─
  useEffect(() => {
    const geoJsonLayer = L.geoJSON(typedGeoData as unknown as GeoJsonObject, {
      style: (feature) => {
        const id = feature?.properties?.id_lote as string;
        const db = lotesRef.current.get(id);
        const estado = (db?.estado || 'DISPONIBLE') as LoteEstado;
        const isVisible = activeFilterRef.current.includes(estado);
        if (!isVisible) return { opacity: 0, fillOpacity: 0, interactive: false };
        const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.DISPONIBLE;
        return {
          color:       cfg.color,
          fillColor:   cfg.fillColor,
          fillOpacity: cfg.fillOpacity,
          weight:      cfg.weight,
          interactive: true,
        };
      },
      onEachFeature: (feature, layer) => {
        const path = layer as L.Path;
        const p = feature.properties as LoteGeoProps;
        featureLayersRef.current.set(p.id_lote, path);

        // Hover styling (instant style change)
        layer.on('mouseover', () => {
          const db = lotesRef.current.get(p.id_lote);
          const estado = (db?.estado || 'DISPONIBLE') as LoteEstado;
          if (!activeFilterRef.current.includes(estado)) return;
          path.setStyle({ weight: 3, fillOpacity: 0.85 });
          path.bringToFront();
        });

        layer.on('mouseout', () => {
          const db = lotesRef.current.get(p.id_lote);
          const estado = (db?.estado || 'DISPONIBLE') as LoteEstado;
          const isVisible = activeFilterRef.current.includes(estado);
          if (!isVisible) {
            path.setStyle({ opacity: 0, fillOpacity: 0, interactive: false });
          } else {
            const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.DISPONIBLE;
            path.setStyle({
              color:       cfg.color,
              fillColor:   cfg.fillColor,
              fillOpacity: cfg.fillOpacity,
              weight:      cfg.weight,
              interactive: true,
            });
          }
        });

        // Click popup
        layer.on('click', (e: L.LeafletMouseEvent) => {
          const currentDb = lotesRef.current.get(p.id_lote) || null;
          callbacksRef.current.onLoteClick(p, currentDb);
          const canEdit = role === 'admin';

          const popupContent = buildPopupContent(
            p,
            currentDb,
            canEdit,
            () => callbacksRef.current.onEditLote(p, currentDb),
            () => callbacksRef.current.onOpenSidebar()
          );

          L.popup({
            className: 'custom-leaflet-popup',
            maxWidth: 320,
            minWidth: 260,
            autoPanPadding: [25, 25],
          })
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(map);
        });
      },
    }).addTo(map);

    return () => {
      map.removeLayer(geoJsonLayer);
      featureLayersRef.current.clear();
    };
  }, [map, role]);

  // ── 3. Ultra-fast style update when lotes or filters change ─
  useEffect(() => {
    featureLayersRef.current.forEach((path, id) => {
      const db = lotes.get(id);
      const estado = (db?.estado || 'DISPONIBLE') as LoteEstado;
      const isVisible = activeFilter.includes(estado);

      if (!isVisible) {
        path.setStyle({ opacity: 0, fillOpacity: 0, interactive: false });
      } else {
        const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.DISPONIBLE;
        path.setStyle({
          color:       cfg.color,
          fillColor:   cfg.fillColor,
          fillOpacity: cfg.fillOpacity,
          weight:      cfg.weight,
          interactive: true,
        });
      }
    });
  }, [lotes, activeFilter]);

  // ── 4. Lot number & area labels (Created ONCE, toggled instantly) ─
  useEffect(() => {
    const grp = L.layerGroup();
    typedGeoData.features.forEach((f: Feature) => {
      const id = f.properties?.id_lote;
      const center = id ? LOTE_CENTERS[id] : null;
      if (center) {
        const area = f.properties?.area_plano;
        const areaFormatted = area != null ? `${Math.round(area)} m²` : '';

        L.marker(center, {
          icon: L.divIcon({
            className:  'lote-label',
            html:       `<div class="lote-label-box"><span class="lote-label-num">${f.properties?.numero}</span>${areaFormatted ? `<span class="lote-label-area">${areaFormatted}</span>` : ''}</div>`,
            iconSize:   [38, 24],
            iconAnchor: [19, 12],
          }),
          interactive: false,
          keyboard:    false,
        }).addTo(grp);
      }
    });

    loteLabelGrpRef.current = grp;
    if (showLabels) grp.addTo(map);

    return () => {
      map.removeLayer(grp);
    };
  }, [map]); // Create once

  // Toggle label visibility
  useEffect(() => {
    if (!loteLabelGrpRef.current) return;
    if (showLabels) {
      if (!map.hasLayer(loteLabelGrpRef.current)) {
        loteLabelGrpRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(loteLabelGrpRef.current)) {
        map.removeLayer(loteLabelGrpRef.current);
      }
    }
  }, [map, showLabels]);

  // ── 5. GPS marker ─────────────────────────────────────
  useEffect(() => {
    if (gpsGroupRef.current) map.removeLayer(gpsGroupRef.current);
    if (!geoLocation) return;

    const { lat, lng, accuracy } = geoLocation;
    const grp = L.layerGroup();

    // Accuracy circle
    L.circle([lat, lng], {
      radius:      accuracy,
      color:       '#3b82f6',
      fillColor:   '#3b82f6',
      fillOpacity: 0.10,
      weight:      1.5,
    }).addTo(grp);

    // Pulsing dot
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="gps-marker"></div>',
        iconSize:   [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(grp);

    grp.addTo(map);
    gpsGroupRef.current = grp;
    map.panTo([lat, lng], { animate: true });

    return () => { grp && map.removeLayer(grp); };
  }, [map, geoLocation]);

  // ── 6. Search: fly to lote & open popup ────────────────
  useEffect(() => {
    if (!searchLote) return;
    const feature = typedGeoData.features.find(
      (f: Feature) => f.properties?.numero === searchLote
    );
    if (feature) {
      const p = feature.properties as LoteGeoProps;
      const center = LOTE_CENTERS[p.id_lote] || BOUNDS.getCenter();
      map.flyTo(center, 18, { duration: 0.8 });

      const currentDb = lotes.get(p.id_lote) || null;
      callbacksRef.current.onLoteClick(p, currentDb);
      const canEdit = role === 'admin';

      const popupContent = buildPopupContent(
        p,
        currentDb,
        canEdit,
        () => callbacksRef.current.onEditLote(p, currentDb),
        () => callbacksRef.current.onOpenSidebar()
      );

      L.popup({
        className: 'custom-leaflet-popup',
        maxWidth: 320,
        minWidth: 260,
        autoPanPadding: [25, 25],
      })
        .setLatLng(center)
        .setContent(popupContent)
        .openOn(map);
    }
  }, [map, searchLote, lotes, role]);

  return null;
};

// ── Public MapView wrapper ─────────────────────────────────
interface MapViewProps {
  lotes:         Map<string, LoteDB>;
  showLabels:    boolean;
  activeFilter:  LoteEstado[];
  geoLocation:   GeoLocation | null;
  searchLote:    number | null;
  role:          UserRole;
  onLoteClick:   (props: LoteGeoProps, db: LoteDB | null) => void;
  onEditLote:    (props: LoteGeoProps, db: LoteDB | null) => void;
  onOpenSidebar: () => void;
}

const MapView: React.FC<MapViewProps> = (props) => (
  <div className="map-container">
    <MapContainer
      center={[CENTER.lat, CENTER.lng]}
      zoom={16}
      zoomControl
      style={{ height: '100%', width: '100%' }}
    >
      <MapContent {...props} />
    </MapContainer>
  </div>
);

export default MapView;



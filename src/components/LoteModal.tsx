import React, { useState } from 'react';
import { LoteDB, LoteEstado, LoteGeoProps, LoteSelected, ESTADO_CONFIG, UserRole } from '../types/lote';

interface LoteModalProps {
  lote:    LoteSelected;
  role:    UserRole;
  onSave:  (updates: Partial<LoteDB>) => Promise<{ error: string | null } | void>;
  onClose: () => void;
}

const LoteModal: React.FC<LoteModalProps> = ({ lote, role, onSave, onClose }) => {
  const { properties: p, db } = lote;
  const isAdmin = role === 'admin';

  const [form, setForm] = useState<Partial<LoteDB>>({
    estado:      db?.estado      || 'DISPONIBLE',
    propietario: db?.propietario || '',
    documento:   db?.documento   || '',
    telefono:    db?.telefono    || '',
    precio:      db?.precio      ?? undefined,
    vendedor:    db?.vendedor    || '',
    observacion: db?.observacion || '',
    fecha_sep:   db?.fecha_sep   || '',
    fecha_venta: db?.fecha_venta || '',
  });
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof LoteDB, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await onSave(form);
    setSaving(false);
    if (res && res.error) {
      setSaveError(res.error);
    } else {
      setSuccess(true);
      setTimeout(onClose, 700);
    }
  };

  const estados: LoteEstado[] = ['DISPONIBLE', 'SEPARADO', 'VENDIDO'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2>✏️ {p.nombre}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Save error banner */}
        {saveError && (
          <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '12px' }}>
            ⚠️ <strong>Error al sincronizar con Supabase:</strong> {saveError}
            <div style={{ marginTop: '4px', opacity: 0.85, fontSize: '11px' }}>
              Copia y ejecuta el archivo <code>supabase_setup.sql</code> en el SQL Editor de tu proyecto Supabase.
            </div>
          </div>
        )}

        {/* Estado selector */}
        <div className="modal-section">
          <p className="modal-section-title">Estado del lote</p>
          <div className="estado-selector">
            {estados.map(e => (
              <button
                key={e}
                className={`estado-radio-btn ${e} ${form.estado === e ? 'active' : ''}`}
                onClick={() => set('estado', e)}
              >
                <span className="estado-icon">{ESTADO_CONFIG[e].icon}</span>
                {ESTADO_CONFIG[e].label}
              </button>
            ))}
          </div>
        </div>

        {/* Propietario & Compra fields */}
        <div className="modal-section">
          <p className="modal-section-title">
            👤 Datos del Propietario / Comprador
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Propietario / Dueño</label>
              <input
                type="text"
                value={form.propietario || ''}
                onChange={e => set('propietario', e.target.value)}
                placeholder="Nombre completo del dueño"
              />
            </div>
            <div className="form-group">
              <label>Documento (CC / NIT)</label>
              <input
                type="text"
                value={form.documento || ''}
                onChange={e => set('documento', e.target.value)}
                placeholder="Ej. 123456789"
              />
            </div>
            <div className="form-group">
              <label>Teléfono de contacto</label>
              <input
                type="tel"
                value={form.telefono || ''}
                onChange={e => set('telefono', e.target.value)}
                placeholder="Ej. 3001234567"
              />
            </div>
            <div className="form-group">
              <label>Precio comercial ($ COP)</label>
              <input
                type="number"
                value={form.precio ?? ''}
                onChange={e => set('precio', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ej. 180000000"
              />
            </div>
          </div>
        </div>

        {/* Commercial management fields */}
        <div className="modal-section">
          <p className="modal-section-title">🤝 Gestión comercial y asesor</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Asesor / Vendedor</label>
              <input
                type="text"
                value={form.vendedor || ''}
                onChange={e => set('vendedor', e.target.value)}
                placeholder="Nombre del asesor"
              />
            </div>
            <div className="form-group">
              {/* spacer */}
            </div>
            <div className="form-group full">
              <label>Observación</label>
              <textarea
                value={form.observacion || ''}
                onChange={e => set('observacion', e.target.value)}
                placeholder="Notas adicionales sobre el lote..."
                rows={2}
              />
            </div>
            <div className="form-group">
              <label>Fecha separación</label>
              <input
                type="date"
                value={form.fecha_sep || ''}
                onChange={e => set('fecha_sep', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Fecha venta</label>
              <input
                type="date"
                value={form.fecha_venta || ''}
                onChange={e => set('fecha_venta', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Info readonly */}
        <div className="modal-section">
          <p className="modal-section-title">Información técnica</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Área en plano</label>
              <input type="text" value={`${p.area_plano} m²`} readOnly style={{ opacity: 0.6, cursor: 'default' }} />
            </div>
            <div className="form-group">
              <label>Área calculada</label>
              <input type="text" value={`${p.area_geom.toFixed(1)} m²`} readOnly style={{ opacity: 0.6, cursor: 'default' }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || success}>
            {success ? '✅ Guardado' : saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoteModal;

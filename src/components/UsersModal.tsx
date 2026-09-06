import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { UserProfile, UserRole } from '../types/lote';
import { normalizeUserIdentifier, formatUserDisplay } from '../hooks/useAuth';

interface UsersModalProps {
  currentUserEmail?: string;
  onClose: () => void;
}

export const UsersModal: React.FC<UsersModalProps> = ({ currentUserEmail, onClose }) => {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // New user form state
  const [activeTab, setActiveTab]       = useState<'list' | 'create'>('list');
  const [newUsername, setNewUsername]   = useState('');
  const [newPass, setNewPass]           = useState('');
  const [newName, setNewName]           = useState('');
  const [newRole, setNewRole]           = useState<UserRole>('comisionista');
  const [creating, setCreating]         = useState(false);

  // Fetch users from profiles table
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
      } else if (data) {
        setUsers(data as UserProfile[]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Change user role
  const handleRoleChange = async (userId: string, targetRole: UserRole) => {
    setError(null);
    setSuccess(null);
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ rol: targetRole })
        .eq('id', userId);

      if (err) {
        setError(`No se pudo actualizar el rol: ${err.message}`);
      } else {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: targetRole } : u));
        setSuccess('Rol actualizado correctamente');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    }
  };

  // Create new user without ending admin session
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const normalizedEmail = normalizeUserIdentifier(newUsername);
      const displayUserName = formatUserDisplay(newUsername);
      const fullName = newName.trim() || displayUserName;

      // Auxiliary Supabase client without session persistence to create user
      const tempClient = createClient(url, key, { auth: { persistSession: false } });

      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: normalizedEmail,
        password: newPass,
        options: {
          data: {
            full_name: fullName,
            username: displayUserName,
          },
        },
      });

      if (authErr) {
        throw authErr;
      }

      const createdUserId = authData.user?.id;

      if (createdUserId) {
        // Upsert profile with selected role and email
        await supabase
          .from('profiles')
          .upsert({
            id: createdUserId,
            email: normalizedEmail,
            nombre: fullName,
            rol: newRole,
            activo: true,
          }, { onConflict: 'id' });
      }

      setSuccess(`✅ Usuario "${displayUserName}" creado exitosamente con rol ${newRole.toUpperCase()}`);
      setNewUsername('');
      setNewPass('');
      setNewName('');
      setNewRole('comisionista');
      await loadUsers();
      setActiveTab('list');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card users-modal-card" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>👥</span>
            <h2>Gestión de Usuarios y Roles</h2>
          </div>
          <button className="btn-icon" onClick={onClose} title="Cerrar">✕</button>
        </div>

        {/* Tabs */}
        <div className="users-modal-tabs">
          <button
            className={`users-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📋 Usuarios ({users.length})
          </button>
          <button
            className={`users-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ➕ Registrar Nuevo Usuario
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="users-alert-error">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="users-alert-success">
            {success}
          </div>
        )}

        {/* Tab 1: Users List */}
        {activeTab === 'list' && (
          <div className="users-list-container">
            {loading ? (
              <div className="map-loading" style={{ minHeight: '160px' }}>
                <div className="loading-spinner" />
                Cargando lista de usuarios...
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No se encontraron usuarios registrados en la tabla <code>profiles</code>.
              </div>
            ) : (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Usuario / Nombre</th>
                      <th>Rol Actual</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isMe = u.email === currentUserEmail;
                      const isAdmin = u.rol === 'admin';
                      const cleanUser = formatUserDisplay(u.email);

                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="user-name-cell">
                              <strong>{u.nombre || cleanUser}</strong>
                              <span className="user-email-text">Usuario: {cleanUser}</span>
                              {isMe && <span className="user-self-badge">Tú</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${isAdmin ? 'admin' : 'comisionista'}`}>
                              {isAdmin ? '👑 Administrador' : '💼 Comisionista'}
                            </span>
                          </td>
                          <td>
                            <div className="user-actions-cell">
                              {isAdmin ? (
                                <button
                                  className="btn-change-role demote"
                                  onClick={() => handleRoleChange(u.id, 'comisionista')}
                                  title="Cambiar a rol de solo lectura"
                                  disabled={isMe}
                                >
                                  💼 Cambiar a Comisionista
                                </button>
                              ) : (
                                <button
                                  className="btn-change-role promote"
                                  onClick={() => handleRoleChange(u.id, 'admin')}
                                  title="Dar permisos de Administrador total"
                                >
                                  👑 Ascender a Admin
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create User Form */}
        {activeTab === 'create' && (
          <form className="users-create-form" onSubmit={handleCreateUser}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Nombre de Usuario (Para iniciar sesión)</label>
              <input
                type="text"
                autoCapitalize="none"
                placeholder="Ej. pedro o asesor1"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Contraseña Provisional</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                minLength={6}
                required
                disabled={creating}
              />
            </div>

            <div className="form-group">
              <label>Rol Inicial Asignado</label>
              <div className="role-options-grid">
                <label className={`role-option-card ${newRole === 'comisionista' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="comisionista"
                    checked={newRole === 'comisionista'}
                    onChange={() => setNewRole('comisionista')}
                  />
                  <div>
                    <strong>💼 Comisionista (Recomendado)</strong>
                    <p>Solo lectura: Puede ver el mapa, buscar lotes, ver disponibilidad y precios, pero NO modificar datos.</p>
                  </div>
                </label>

                <label className={`role-option-card ${newRole === 'admin' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={newRole === 'admin'}
                    onChange={() => setNewRole('admin')}
                  />
                  <div>
                    <strong>👑 Administrador</strong>
                    <p>Acceso total: Puede editar estados, precios, asignar compradores y gestionar usuarios.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab('list')}
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ width: 'auto' }}
                disabled={creating || !newUsername || !newPass}
              >
                {creating ? '⏳ Registrando...' : '➕ Registrar Usuario'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

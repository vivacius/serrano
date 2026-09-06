import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [nombre,   setNombre]   = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (mode === 'login') {
      const { error: err } = await signIn(username.trim(), password);
      if (err) {
        setError(err.message === 'Invalid login credentials'
          ? 'Usuario o contraseña incorrectos'
          : err.message
        );
      }
    } else {
      // Register
      const { data, error: err } = await signUp(username.trim(), password, nombre.trim());
      if (err) {
        setError(err.message);
      } else {
        if (data.session) {
          setInfo('✅ Cuenta creada correctamente. Ingresando...');
        } else {
          setInfo('✅ Registro exitoso. Ya puedes iniciar sesión con tu usuario y contraseña.');
          setMode('login');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="login-bg-video"
      >
        <source src="/video_fondo.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient blur overlay */}
      <div className="login-video-overlay" />

      <div className="login-card">
        <div className="login-logo">
          <img src="/logo_sin_fondo.png" alt="Serrano Inmobiliaria" className="login-logo-img" />
          <h1>Condominio Amaranta</h1>
          <p>Visor interactivo de lotes</p>
        </div>

        {/* Tab switch */}
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`login-mode-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`login-mode-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setInfo(''); }}
          >
            Crear Cuenta
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="nombre">Nombre completo</label>
              <input
                id="nombre"
                type="text"
                placeholder="Ej. Pedro Morales"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              {mode === 'login' ? 'Usuario o Correo electrónico' : 'Nombre de Usuario'}
            </label>
            <input
              id="username"
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              placeholder={mode === 'login' ? 'Ej. tu_correo@gmail.com o admin' : 'Ej. pedro o asesor1'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              required
              disabled={loading}
            />
          </div>

          {mode === 'register' && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '4px 0 8px' }}>
              ℹ️ Las cuentas nuevas se registran con rol <strong>Comisionista (Solo lectura)</strong>. El administrador puede otorgarte permisos adicionales.
            </div>
          )}

          {error && <div className="login-error">⚠️ {error}</div>}
          {info && <div className="login-success" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', color: '#86efac', fontSize: '13px', padding: '10px 14px', textAlign: 'center' }}>{info}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !username || !password || (mode === 'register' && !nombre)}
          >
            {loading ? '⏳ Procesando...' : mode === 'login' ? '→ Ingresar al visor' : '✨ Crear cuenta de comisionista'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

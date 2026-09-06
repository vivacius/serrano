import React from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Verificando sesión...</p>
      </div>
    );
  }

  return user ? <MapPage /> : <LoginPage />;
};

export default App;

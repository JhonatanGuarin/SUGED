import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './app/AuthContext'; // Usamos nuestro nuevo gancho (hook)

import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import Escenarios from './features/escenarios/Escenarios';
import Reservas from './features/reservas/Reservas';
import Layout from './components/layout/Layout';


export default function App() {
  // ¡Magia! Solo le pedimos al contexto si hay sesión y si está cargando
  const { session, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">Cargando SUGED...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
      
      <Route element={session ? <Layout /> : <Navigate to="/login" />}>
        {/* Ya no necesitamos pasarle 'session={session!}' al Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/escenarios" element={<Escenarios />} />
        <Route path="/reservas" element={<Reservas />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}
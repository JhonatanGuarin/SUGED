import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './app/AuthContext';
import type { ReactNode } from 'react'; 
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import Escenarios from './features/escenarios/Escenarios';
import Reservas from './features/reservas/Reservas';
import Layout from './components/layout/Layout';

const RutaProtegida = ({ children, rolesPermitidos }: { children: ReactNode, rolesPermitidos: string[] }) => {
  const { perfil } = useAuth();
  if (perfil && !rolesPermitidos.includes(perfil.rol)) {
    return <Navigate to="/escenarios" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  const { session, cargando } = useAuth();

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">Cargando SUGED...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
      
      <Route element={session ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/escenarios" element={<Escenarios />} />
        <Route path="/reservas" element={
          <RutaProtegida rolesPermitidos={['ADMIN', 'MEMBER_UPTC']}>
            <Reservas />
          </RutaProtegida>
        } />
      </Route>

      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}
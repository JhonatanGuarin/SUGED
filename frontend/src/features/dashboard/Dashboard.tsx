import { useAuth } from '../../app/AuthContext';

export default function Dashboard() {
  // Sacamos el perfil y la sesión directamente del contexto global
  const { session, perfil, cargando } = useAuth();

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      
      <div className="mb-8 pb-6 border-b border-slate-100">
        <h1 className="text-3xl font-bold text-slate-800">Panel Principal</h1>
        <p className="text-slate-500 mt-1">Bienvenido al Sistema de Reservas Deportivas de la UPTC</p>
      </div>
      
      {cargando ? (
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-slate-200 h-16 w-16"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      ) : perfil && session ? (
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl flex items-center gap-6">
          <img 
            src={perfil.avatar_url || 'https://www.svgrepo.com/show/497407/profile-circle.svg'} 
            alt="Avatar" 
            className="w-16 h-16 rounded-full border-2 border-white shadow-sm"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-xl font-bold text-slate-800">{perfil.nombre_completo}</h2>
            <p className="text-slate-600">{session.user.email}</p>
            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              Rol: {perfil.rol}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
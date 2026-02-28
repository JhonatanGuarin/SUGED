import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { supabase } from '../../app/supabase';
import { MapPin, Calendar, CreditCard, LogOut, Menu, X, User as UserIcon } from 'lucide-react';

export default function Layout() {
  const { perfil, session } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const manejarCerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Definimos las rutas dinámicamente según el rol
  const navLinks = [
    { to: "/escenarios", icon: <MapPin size={20} />, label: "Escenarios" },
    { to: "/reservas", icon: <Calendar size={20} />, label: perfil?.rol === 'ADMIN' ? "Todas las Reservas" : "Mis Reservas" },
    // Ocultamos el módulo de pagos si no es ADMIN (podrás ajustarlo luego según tus RFs)
    ...(perfil?.rol === 'ADMIN' ? [{ to: "/pagos", icon: <CreditCard size={20} />, label: "Pagos" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* HEADER MÓVIL (Solo visible en celulares) */}
      <div className="md:hidden bg-[#1A1A1A] text-white flex items-center justify-between p-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FFCC29] rounded-md flex items-center justify-center font-black text-[#1A1A1A]">
            S
          </div>
          <span className="font-black text-lg tracking-wider text-white">SUGED</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="text-[#FFCC29] hover:text-white transition-colors p-1"
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* SIDEBAR (Menú lateral) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#1A1A1A] text-slate-300 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo Institucional (Escritorio) */}
        <div className="hidden md:flex items-center gap-4 p-6 border-b border-slate-800/80">
           <div className="w-12 h-12 bg-[#FFCC29] rounded-xl flex items-center justify-center font-black text-[#1A1A1A] text-2xl shadow-lg shadow-[#FFCC29]/20">
            S
          </div>
          <div>
            <span className="font-black text-2xl tracking-wider text-white block leading-tight">SUGED</span>
            <span className="text-[10px] text-[#FFCC29] uppercase tracking-widest font-bold">UPTC Deportes</span>
          </div>
        </div>

        {/* Perfil del Usuario */}
        <div className="p-6 border-b border-slate-800/80 flex items-center gap-4 bg-black/20">
          <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-[#FFCC29] overflow-hidden flex-shrink-0">
            {session?.user?.user_metadata?.avatar_url ? (
              <img src={session.user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-700 text-[#FFCC29]"><UserIcon size={24} /></div>
            )}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{session?.user?.user_metadata?.full_name || 'Usuario'}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-[#FFCC29]/10 text-[#FFCC29] text-[10px] uppercase font-bold tracking-wider rounded-md border border-[#FFCC29]/20">
              {perfil?.rol === 'ADMIN' ? 'Administrador' : 
              perfil?.rol === 'MEMBER_UPTC' ? 'Miembro UPTC' : 'Usuario Externo'}
            </span>
          </div>
        </div>

        {/* Navegación Principal */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)} 
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 group
                ${isActive 
                  ? 'bg-[#FFCC29] text-[#1A1A1A] shadow-lg shadow-[#FFCC29]/10' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              {/* Aquí envolvemos el contenido en una función para tener acceso a isActive */}
              {({ isActive }) => (
                <>
                  <span className={`${isActive ? 'text-[#1A1A1A]' : 'text-slate-500 group-hover:text-[#FFCC29] transition-colors'}`}>
                    {link.icon}
                  </span>
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Botón de Cerrar Sesión */}
        <div className="p-4 border-t border-slate-800/80">
          <button 
            onClick={manejarCerrarSesion}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Fondo oscuro cuando el menú móvil está abierto */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Área de Contenido Principal (donde cargan Escenarios, Reservas, etc.) */}
      <main className="flex-1 p-0 md:p-6 overflow-y-auto w-full mx-auto bg-slate-50">
        <div className="max-w-[1600px] mx-auto h-full">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
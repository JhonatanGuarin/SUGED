import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthContext' // 1. Importamos el proveedor
import App from './App.tsx'
import './app/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 2. Envolvemos todo dentro del AuthProvider */}
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthContext' 
import { Toaster } from 'sonner';
import App from './App.tsx'
import './app/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
    <Toaster position="bottom-right" richColors />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
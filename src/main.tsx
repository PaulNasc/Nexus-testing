import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ThemeProvider } from './hooks/useTheme.tsx'
import { PermissionsProvider } from './hooks/usePermissions.tsx'

// Garantir que o elemento root existe
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento root não encontrado");

// Criar root usando a API do React 18
const root = createRoot(rootElement);

// Renderizar com StrictMode e AuthProvider
root.render(
  <React.StrictMode>
    <AuthProvider>
      <PermissionsProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </PermissionsProvider>
    </AuthProvider>
  </React.StrictMode>
);

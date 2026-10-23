import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './auth/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false,staleTime: 30_000 } } })
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
</BrowserRouter>
)

import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'

export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p role="status" className="p-8 text-center text-muted">Checking your session…</p>
  if (!user) return <Navigate to="/roles" replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />
  return <>{children}</>
}
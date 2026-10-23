import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export type User = { id: number; fullName: string; email: string; phone: string | null; role: string; status: string }
type Ctx = {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string, expectedRole?: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then(r => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(identifier: string, password: string, expectedRole?: string) {
    const { user: u } = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { identifier, password } })
    if (expectedRole && u.role !== expectedRole) {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
      throw new Error(`This is not a ${expectedRole} account. Go back and choose your role.`)
    }
    setUser(u)
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }
  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>
}

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Button } from './Button'
import { Logo } from './Logo'

export function AppShell({ roleLabel, tabs, children }: { roleLabel: string; tabs?: ReactNode; children: ReactNode }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Logo size={30} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{roleLabel} · {user?.fullName}</span>
            <Button variant="secondary" onClick={async () => { await logout(); nav('/roles') }}>Sign out</Button>
          </div>
        </div>
        {tabs && <div className="mx-auto max-w-6xl px-5">{tabs}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  )
}
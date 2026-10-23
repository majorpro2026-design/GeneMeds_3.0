import { ScrollText, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/Button'
import { Logo } from '../../components/Logo'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-lav-light text-violet' : 'text-muted hover:bg-lav-pale hover:text-ink'}`
  const initials = (user?.fullName ?? '').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:py-6"><Logo size={36} /></div>
        <p className="hidden px-6 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted lg:block">Administration</p>
        <nav aria-label="Admin" className="flex gap-1 px-3 pb-3 lg:flex-col lg:pb-0">
          <NavLink to="/admin" end className={link}><Users className="size-[18px]" aria-hidden /> Users and access</NavLink>
          <NavLink to="/admin/audit" className={link}><ScrollText className="size-[18px]" aria-hidden /> Audit log</NavLink>
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-bold text-navy">Admin console</span>
            <span className="rounded-full bg-admin/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-admin">ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm leading-tight sm:block"><strong className="block text-navy">{user?.fullName}</strong><span className="text-xs text-muted">System administrator</span></span>
            <span className="grid size-10 place-items-center rounded-full bg-lav-light font-heading text-sm font-extrabold text-violet">{initials}</span>
            <Button variant="secondary" onClick={async () => { await logout(); nav('/roles') }}>Sign out</Button>
          </div>
        </header>
        <main className="px-5 py-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  )
}
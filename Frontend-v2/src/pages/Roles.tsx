import { ChevronRight } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ROLES, roleHome } from '../lib/roles'

export function Roles() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={roleHome(user.role)} replace />
  return (
    <div className="w-full max-w-lg">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Choose your role</h1>
      <p className="mb-6 text-muted">Select how you use GeneMeds to sign in or create an account.</p>
      <ul className="grid gap-3.5">
        {ROLES.map(r => (
          <li key={r.key}>
            <Link to={`/auth/${r.key}`} className={`flex items-center gap-4 rounded-card border border-line bg-white p-5 shadow-card transition hover:translate-x-1.5 ${r.hover}`}>
              <span className={`grid size-12 shrink-0 place-items-center rounded-card ${r.chip}`}><r.icon className="size-6" aria-hidden /></span>
              <span className="flex-1">
                <strong className="block font-heading text-lg text-navy">{r.name}</strong>
                <span className="text-sm text-muted">{r.blurb}</span>
              </span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
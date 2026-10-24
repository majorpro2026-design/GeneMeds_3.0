import { ChevronRight } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ROLES, roleHome } from '../lib/roles'

export function Roles() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={roleHome(user.role)} replace />

  return (
    <div className="w-full max-w-[580px]">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Choose your role
        </h1>
        <p className="mt-2 text-base text-muted sm:text-[1.05rem]">
          Select how you use GeneMeds to sign in or create an account.
        </p>
      </header>

      <ul className="grid gap-3.5" role="list">
        {ROLES.map(r => (
          <li key={r.key}>
            <Link
              to={`/auth/${r.key}`}
              className={`group flex items-center gap-4 rounded-card border border-line bg-white p-5 shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 active:scale-[0.99] active:shadow-sm ${r.hover}`}
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-card transition-colors duration-200 ${r.chip}`}
              >
                <r.icon className="size-6 transition-transform duration-200 group-hover:scale-105" aria-hidden />
              </span>

              <span className="flex-1 min-w-0 pr-1">
                <strong className="block font-heading text-lg font-semibold text-navy tracking-tight">
                  {r.name}
                </strong>
                <span className="mt-0.5 block text-sm text-muted leading-normal">
                  {r.blurb}
                </span>
              </span>

              <ChevronRight
                className="size-5 shrink-0 text-muted/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-navy"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
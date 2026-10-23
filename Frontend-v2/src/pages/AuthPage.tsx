import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/Card'
import { RegisterForm } from '../components/RegisterForm'
import { SignInForm } from '../components/SignInForm'
import { ROLES, roleHome } from '../lib/roles'

export function AuthPage() {
  const { role: key } = useParams()
  const { user } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const role = ROLES.find(r => r.key === key)
  if (!role) return <Navigate to="/roles" replace />
  if (user?.role === role.key) return <Navigate to={roleHome(role.key)} replace />

  const tab = (m: 'in' | 'up', label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={`h-9 flex-1 rounded-ctl text-sm font-semibold transition ${mode === m ? 'bg-white text-violet shadow-card' : 'text-muted hover:text-ink'}`}>{label}</button>
  )
  return (
    <div className={`w-full ${mode === 'up' ? 'max-w-2xl' : 'max-w-md'}`}>
      <Link to="/roles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-violet">
        <ArrowLeft className="size-4" aria-hidden /> Choose a different role
      </Link>
      <div className="mb-5 flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-card ${role.chip}`}><role.icon className="size-6" aria-hidden /></span>
        <h1 className="text-3xl font-extrabold">{role.name}</h1>
      </div>
      <Card>
        {role.canRegister && (
          <div role="tablist" className="mb-5 flex gap-1 rounded-card border border-line bg-lav-pale p-1">
            {tab('in', 'Sign in')}{tab('up', 'Create new account')}
          </div>
        )}
        {mode === 'in' || !role.canRegister
          ? <SignInForm role={role.key} button={role.button} />
          : <RegisterForm role={role.key as 'doctor' | 'receptionist'} button={role.button} onRegistered={() => setMode('in')} />}
        {role.canRegister && (
          <p className="mt-4 text-center text-sm text-muted">
            {mode === 'in' ? 'New here? ' : 'Already registered? '}
            <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="font-bold text-violet underline underline-offset-4">
              {mode === 'in' ? 'Create new account' : 'Sign in'}
            </button>
          </p>
        )}
        {role.note && <p className="mt-4 text-center text-xs text-muted">{role.note}</p>}
      </Card>
    </div>
  )
}